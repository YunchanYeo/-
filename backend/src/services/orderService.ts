import crypto from 'node:crypto';
import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Db } from '../types';
import { hydrateOrderItemsWithProduct } from './orderItemImages';
import { resolveKuaidiCom } from './logistics/resolveKuaidiCom';
import { queryKuaidi100RealTime } from './logistics/kuaidi100Query';

function genTradeNo() {
  const ts = Date.now();
  const rand = crypto.randomInt(100000, 999999);
  return `${ts}${rand}`;
}

export function createOrderService({ db, paymentMockMode }: { db: Db; paymentMockMode: boolean }) {
  function getPointPolicy() {
    const rows = db
      .prepare(`SELECT key, value FROM app_settings WHERE key IN ('pointsEarnRatePercent', 'pointsUseThreshold')`)
      .all() as Array<{ key: string; value: string }>;
    const map = new Map(rows.map((x) => [x.key, x.value]));
    const pointsEarnRatePercent = Math.max(0, Number(map.get('pointsEarnRatePercent') ?? 1));
    const pointsUseThreshold = Math.max(0, Math.floor(Number(map.get('pointsUseThreshold') ?? 1000)));
    return { pointsEarnRatePercent, pointsUseThreshold };
  }

  function pointsConfig(req: Request, res: Response) {
    return res.json({ ok: true, data: getPointPolicy() });
  }

  function commitOrder(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const schema = z.object({
      totalAmount: z.number().nonnegative().optional(),
      pointsToUse: z.number().int().nonnegative().optional(),
      goodsRequestList: z.array(z.any()).optional(),
      userName: z.string().optional(),
      paymentMethod: z
        .enum(['requestPayment', 'requestPluginPayment', 'requestCommonPayment', 'requestGlobalPayment', 'requestVirtualPayment'])
        .optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid order body', issues: parsed.error.issues });

    const tradeNo = genTradeNo();
    const totalAmount = parsed.data.totalAmount ?? 0;
    const pointsToUseRequested = parsed.data.pointsToUse ?? 0;
    const paymentMethod = parsed.data.paymentMethod || 'requestPayment';
    const orderItemsRaw = parsed.data.goodsRequestList ?? [];
    const orderItems = hydrateOrderItemsWithProduct(db, orderItemsRaw);
    const orderAddress = (req.body as any)?.userAddressReq ?? {};

    if (userId) {
      const user = db.prepare(`SELECT points FROM users WHERE id = ?`).get(userId) as { points: number } | undefined;
      const userPoints = Number(user?.points || 0);
      let pointsToUse = 0;
      if (pointsToUseRequested > 0) {
        const policy = getPointPolicy();
        if (userPoints < policy.pointsUseThreshold) {
          return res.status(400).json({ ok: false, message: `积分满 ${policy.pointsUseThreshold} 才可抵扣` });
        }
        if (pointsToUseRequested > userPoints) {
          return res.status(400).json({ ok: false, message: '积分不足，无法抵扣' });
        }
        pointsToUse = Math.min(pointsToUseRequested, totalAmount);
      }
      db.prepare(
        `INSERT INTO orders (
          orderNo, userId, totalAmount, paymentAmount, refundAmount, refundStatus, orderStatus, orderStatusName,
          itemsJson, addressJson, pointsUsed, pointsEarned, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ).run(
        tradeNo,
        userId,
        totalAmount,
        totalAmount,
        0,
        0,
        5,
        '待付款',
        JSON.stringify(orderItems),
        JSON.stringify(orderAddress),
        pointsToUse,
        0,
      );
    }

    const payInfo = {
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: crypto.randomBytes(12).toString('hex'),
      package: `prepay_id=mock_${tradeNo}`,
      signType: 'RSA',
      paySign: 'MOCK_PAY_SIGN',
    };

    return res.json({
      ok: true,
      data: {
        isSuccess: true,
        tradeNo,
        transactionId: `TXN_${tradeNo}`,
        interactId: `INT_${tradeNo}`,
        channel: 'wechat',
        payAmt: totalAmount,
        payInfo: JSON.stringify(payInfo),
        paymentMethod,
        pluginPaymentData: null,
        commonPayInfo: null,
        globalPayInfo: null,
        isMockPay: paymentMockMode,
        limitGoodsList: null,
      },
      code: 'Success',
      msg: null,
    });
  }

  function markOrderPaid(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const orderNo = String(req.params.orderNo || '').trim();
    if (!orderNo) return res.status(400).json({ ok: false, message: 'Invalid orderNo' });
    const order = db
      .prepare(`SELECT id, orderStatus, paymentAmount, pointsUsed FROM orders WHERE userId = ? AND orderNo = ?`)
      .get(userId, orderNo) as { id: number; orderStatus: number; paymentAmount: number; pointsUsed: number } | undefined;
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    if (order.orderStatus === 10 || order.orderStatus === 40 || order.orderStatus === 50) {
      return res.json({ ok: true, data: { ok: true } });
    }
    if (order.orderStatus !== 5) {
      return res.status(409).json({ ok: false, message: '当前订单状态不可支付' });
    }
    const pointsUsed = Number(order.pointsUsed || 0);
    const policy = getPointPolicy();
    const pointsEarned = Math.floor((Number(order.paymentAmount || 0) * Number(policy.pointsEarnRatePercent || 0)) / 100);
    const txn = db.transaction(() => {
      if (pointsUsed > 0) {
        const user = db.prepare(`SELECT points FROM users WHERE id = ?`).get(userId) as { points: number } | undefined;
        const userPoints = Number(user?.points || 0);
        if (userPoints < pointsUsed) {
          throw new Error('积分不足，无法完成支付');
        }
      }
      db.prepare(
        `UPDATE users
         SET points = MAX(points - ?, 0) + ?,
             updatedAt = datetime('now')
         WHERE id = ?`,
      ).run(pointsUsed, pointsEarned, userId);
      db.prepare(
        `UPDATE orders
         SET orderStatus = 10,
             orderStatusName = '待发货',
             pointsEarned = ?,
             updatedAt = datetime('now')
         WHERE id = ?`,
      ).run(pointsEarned, order.id);
    });
    try {
      txn();
    } catch (e: any) {
      return res.status(409).json({ ok: false, message: String(e?.message || '支付失败') });
    }
    return res.json({ ok: true, data: { ok: true } });
  }

  function cancelOrder(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const orderNo = String(req.params.orderNo || '').trim();
    if (!orderNo) return res.status(400).json({ ok: false, message: 'Invalid orderNo' });
    const order = db
      .prepare(`SELECT id, orderStatus, refundStatus FROM orders WHERE userId = ? AND orderNo = ?`)
      .get(userId, orderNo) as { id: number; orderStatus: number; refundStatus: number } | undefined;
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    if (order.refundStatus === 1) return res.status(409).json({ ok: false, message: 'Order already refunded' });
    if (order.orderStatus !== 5) {
      return res.status(409).json({ ok: false, message: '仅待付款订单可取消' });
    }
    db.prepare(
      `UPDATE orders
       SET orderStatus = 80,
           orderStatusName = '已取消',
           updatedAt = datetime('now')
       WHERE id = ?`,
    ).run(order.id);
    return res.json({ ok: true, data: { ok: true } });
  }

  function confirmOrderReceived(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const orderNo = String(req.params.orderNo || '').trim();
    if (!orderNo) return res.status(400).json({ ok: false, message: 'Invalid orderNo' });
    const order = db
      .prepare(`SELECT id, orderStatus, refundStatus FROM orders WHERE userId = ? AND orderNo = ?`)
      .get(userId, orderNo) as { id: number; orderStatus: number; refundStatus: number } | undefined;
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    if (order.refundStatus === 1) return res.status(409).json({ ok: false, message: 'Order already refunded' });
    if (order.orderStatus !== 20 && order.orderStatus !== 40) {
      return res.status(409).json({ ok: false, message: '仅待收货订单可确认收货' });
    }
    db.prepare(
      `UPDATE orders
       SET orderStatus = 50,
           orderStatusName = '已完成',
           updatedAt = datetime('now')
       WHERE id = ?`,
    ).run(order.id);
    return res.json({ ok: true, data: { ok: true } });
  }

  function deleteOrder(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const orderNo = String(req.params.orderNo || '').trim();
    if (!orderNo) return res.status(400).json({ ok: false, message: 'Invalid orderNo' });
    const order = db
      .prepare(`SELECT id, orderStatus FROM orders WHERE userId = ? AND orderNo = ?`)
      .get(userId, orderNo) as { id: number; orderStatus: number } | undefined;
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    if (order.orderStatus !== 80 && order.orderStatus !== 50) {
      return res.status(409).json({ ok: false, message: '仅已完成或已取消订单可删除' });
    }
    const ret = db.prepare(`DELETE FROM orders WHERE id = ?`).run(order.id);
    if ((ret?.changes || 0) < 1) {
      return res.status(500).json({ ok: false, message: '删除失败：订单未实际删除' });
    }
    return res.json({ ok: true, data: { ok: true, deletedRows: ret.changes } });
  }

  function listOrders(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const rows = db
      .prepare(
        `SELECT id, orderNo, totalAmount, paymentAmount, refundAmount, refundStatus, refundReason, refundedAt,
                orderStatus, orderStatusName, itemsJson, addressJson, pointsUsed, pointsEarned, createdAt,
                logisticsCompanyCode, logisticsCompanyName, logisticsNo, logisticsRemark, shippedAt
         FROM orders
         WHERE userId = ?
         ORDER BY id DESC`,
      )
      .all(userId);
    const data = rows.map((row: any) => ({
      ...row,
      items: hydrateOrderItemsWithProduct(db, JSON.parse(row.itemsJson || '[]')),
      address: JSON.parse(row.addressJson || '{}'),
    }));
    return res.json({ ok: true, data });
  }

  function ordersCount(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const c = (sql: string) => ((db.prepare(sql).get(userId) as { n: number } | undefined)?.n ?? 0) as number;
    const total = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ?`);
    const pendingPay = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ? AND orderStatus = 5`);
    const pendingDelivery = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ? AND orderStatus = 10`);
    const pendingReceipt = c(
      `SELECT COUNT(*) as n FROM orders WHERE userId = ? AND orderStatus IN (20, 40)`,
    );
    const completed = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ? AND orderStatus = 50`);
    const afterSale = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ? AND refundStatus = 1`);
    return res.json({
      ok: true,
      data: [
        { tabType: -1, orderNum: total },
        { tabType: 5, orderNum: pendingPay },
        { tabType: 10, orderNum: pendingDelivery },
        { tabType: 40, orderNum: pendingReceipt },
        { tabType: 50, orderNum: completed },
        { tabType: 0, orderNum: afterSale },
      ],
    });
  }

  function getOrderDetail(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const row = db
      .prepare(
        `SELECT id, orderNo, totalAmount, paymentAmount, refundAmount, refundStatus, refundReason, refundedAt,
                orderStatus, orderStatusName, itemsJson, addressJson, pointsUsed, pointsEarned, createdAt,
                logisticsCompanyCode, logisticsCompanyName, logisticsNo, logisticsRemark, shippedAt
         FROM orders
         WHERE userId = ? AND orderNo = ?`,
      )
      .get(userId, req.params.orderNo);
    if (!row) return res.status(404).json({ ok: false, message: 'Order not found' });
    const r: any = row;
    return res.json({
      ok: true,
      data: {
        ...r,
        items: hydrateOrderItemsWithProduct(db, JSON.parse(r.itemsJson || '[]')),
        address: JSON.parse(r.addressJson || '{}'),
      },
    });
  }

  function refundOrder(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const schema = z.object({ reason: z.string().optional(), refundAmount: z.number().int().nonnegative().optional() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid refund body', issues: parsed.error.issues });

    const order = db.prepare(`SELECT * FROM orders WHERE userId = ? AND orderNo = ?`).get(userId, req.params.orderNo) as any;
    if (!order) return res.status(404).json({ ok: false, message: 'Order not found' });
    if (order.refundStatus === 1) return res.status(409).json({ ok: false, message: 'Order already refunded' });

    const refundAmount = Math.min(parsed.data.refundAmount ?? order.paymentAmount, order.paymentAmount);
    db.prepare(
      `UPDATE orders
       SET refundStatus = 1,
           refundAmount = ?,
           refundReason = ?,
           refundedAt = datetime('now'),
           orderStatus = 50,
           orderStatusName = '已完成',
           updatedAt = datetime('now')
       WHERE id = ?`,
    ).run(refundAmount, parsed.data.reason ?? '', order.id);

    const updated = db
      .prepare(
        `SELECT id, orderNo, totalAmount, paymentAmount, refundAmount, refundStatus, refundReason, refundedAt,
                orderStatus, orderStatusName, itemsJson, addressJson, createdAt
         FROM orders WHERE id = ?`,
      )
      .get(order.id) as any;

    return res.json({
      ok: true,
      data: {
        ...updated,
        items: hydrateOrderItemsWithProduct(db, JSON.parse(updated.itemsJson || '[]')),
        address: JSON.parse(updated.addressJson || '{}'),
      },
    });
  }

  async function orderLogisticsTrace(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const orderNo = String(req.params.orderNo || '').trim();
    if (!orderNo) return res.status(400).json({ ok: false, message: '缺少订单号' });

    const row = db
      .prepare(
        `SELECT orderNo, logisticsCompanyCode, logisticsCompanyName, logisticsNo, addressJson
         FROM orders
         WHERE userId = ? AND orderNo = ?`,
      )
      .get(userId, orderNo) as
      | {
          orderNo: string;
          logisticsCompanyCode: string | null;
          logisticsCompanyName: string | null;
          logisticsNo: string | null;
          addressJson: string | null;
        }
      | undefined;
    if (!row) return res.status(404).json({ ok: false, message: '订单不存在' });

    const logisticsNo = String(row.logisticsNo || '').trim();
    if (!logisticsNo) {
      return res.status(400).json({ ok: false, message: '该订单尚未填写运单号' });
    }

    const key = String(process.env.KUAIDI100_KEY || '').trim();
    const customer = String(process.env.KUAIDI100_CUSTOMER || '').trim();
    if (!key || !customer) {
      return res.json({
        ok: true,
        data: {
          configured: false,
          hint: '请在服务器环境变量中配置 KUAIDI100_KEY、KUAIDI100_CUSTOMER（快递100企业版）后重启后端。',
          orderNo,
          logisticsCompanyName: row.logisticsCompanyName || '',
          logisticsNo,
          traces: [],
          polylinePoints: [],
        },
      });
    }

    const com = resolveKuaidiCom({
      logisticsCompanyCode: row.logisticsCompanyCode || '',
      logisticsCompanyName: row.logisticsCompanyName || '',
    });
    if (!com) {
      return res.status(400).json({
        ok: false,
        message:
          '无法匹配快递公司编码。请在填写运单时使用常见名称（如：顺丰快递、中通快递）或在 logisticsCompanyCode 中填写快递100编码（如 shunfeng）。',
      });
    }

    let phone = '';
    try {
      const addr = JSON.parse(row.addressJson || '{}') as Record<string, unknown>;
      phone = String(addr.phone || addr.phoneNumber || addr.tel || addr.mobile || '').trim();
    } catch (_) {
      phone = '';
    }

    try {
      const result = await queryKuaidi100RealTime({
        key,
        customer,
        com,
        num: logisticsNo,
        ...(phone ? { phone } : {}),
      });
      return res.json({
        ok: true,
        data: {
          configured: true,
          orderNo,
          logisticsCompanyName: row.logisticsCompanyName || '',
          logisticsNo,
          requestedCom: com,
          state: result.state,
          resolvedCom: result.com,
          nu: result.nu,
          traces: result.traces,
          polylinePoints: result.polylinePoints,
          routeInfo: result.routeInfo,
          kuaidiMessage: result.rawMessage,
        },
      });
    } catch (e: any) {
      const msg = String(e?.message || '快递查询失败');
      return res.status(502).json({ ok: false, message: msg });
    }
  }

  return {
    commitOrder,
    markOrderPaid,
    cancelOrder,
    confirmOrderReceived,
    deleteOrder,
    pointsConfig,
    listOrders,
    ordersCount,
    getOrderDetail,
    refundOrder,
    orderLogisticsTrace,
  };
}
