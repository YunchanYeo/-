import crypto from 'node:crypto';
import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Db } from '../types';
import {
  buildMiniProgramPayParams,
  decryptNotifyCiphertext,
  jsapiTransactions,
  shouldUseRealWechatPay,
  verifyNotifySignature,
  type WechatPayV3Config,
} from './wechatPayV3';
import {
  isAlipayTradeSuccess,
  requestAlipayTradeWapPayHtml,
  shouldUseRealAlipayPay,
  verifyAlipayNotifyParams,
  type AlipayWapConfig,
} from './alipayWap';
import { hydrateOrderItemsWithProduct } from './orderItemImages';
import { applyStockDecrementForOrderItems, restoreStockForOrderItems } from './orderInventory';
import { resolveKuaidiCom } from './logistics/resolveKuaidiCom';
import { queryKuaidi100RealTime } from './logistics/kuaidi100Query';

function genTradeNo() {
  const ts = Date.now();
  const rand = crypto.randomInt(100000, 999999);
  return `${ts}${rand}`;
}

function getPayLaunchSecret(): string {
  return String(
    process.env.PAY_LAUNCH_TOKEN_SECRET || process.env.ALIPAY_WAP_LAUNCH_SECRET || 'dev-pay-launch-secret-change-me',
  ).trim();
}

function signPayLaunch(parts: string[]): string {
  return crypto.createHmac('sha256', getPayLaunchSecret()).update(parts.join('|')).digest('hex');
}

function verifyWapLaunch(orderNo: string, exp: number, sig: string): boolean {
  if (!orderNo || !sig || !Number.isFinite(exp)) return false;
  if (exp * 1000 < Date.now()) return false;
  return signPayLaunch([orderNo, String(exp), 'wap']) === sig;
}

function verifyBridgeSig(orderNo: string, kind: 'return' | 'quit', sig: string): boolean {
  if (!orderNo || !sig) return false;
  return signPayLaunch([orderNo, kind]) === sig;
}

export function createOrderService({
  db,
  paymentMockMode,
  wechatPayConfig,
  alipayPaymentMockMode,
  alipayWapConfig,
}: {
  db: Db;
  paymentMockMode: boolean;
  wechatPayConfig: WechatPayV3Config | null;
  alipayPaymentMockMode: boolean;
  alipayWapConfig: AlipayWapConfig | null;
}) {
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

  /** 支付成功落库（幂等）；notify 不传 requireUserId，用户主动确认传 userId */
  function finalizeOrderPaid(orderNo: string, requireUserId?: number): { ok: true } | { ok: false; message: string } {
    const order = db
      .prepare(
        `SELECT id, userId, orderStatus, paymentAmount, pointsUsed, itemsJson FROM orders WHERE orderNo = ?`,
      )
      .get(orderNo) as
      | {
          id: number;
          userId: number;
          orderStatus: number;
          paymentAmount: number;
          pointsUsed: number;
          itemsJson: string;
        }
      | undefined;
    if (!order) return { ok: false, message: 'Order not found' };
    if (requireUserId !== undefined && order.userId !== requireUserId) return { ok: false, message: 'Order not found' };
    if (order.orderStatus === 10 || order.orderStatus === 40 || order.orderStatus === 50) return { ok: true };
    if (order.orderStatus !== 5) return { ok: false, message: '当前订单状态不可支付' };
    const userId = order.userId;
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
      applyStockDecrementForOrderItems(db, String(order.itemsJson || '[]'));
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
      return { ok: false, message: String(e?.message || '支付失败') };
    }
    return { ok: true };
  }

  async function commitOrder(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const schema = z.object({
      totalAmount: z.number().nonnegative().optional(),
      pointsToUse: z.number().int().nonnegative().optional(),
      goodsRequestList: z.array(z.any()).optional(),
      userName: z.string().optional(),
      payChannel: z.enum(['wechat', 'alipay']).optional().default('wechat'),
      paymentMethod: z
        .enum(['requestPayment', 'requestPluginPayment', 'requestCommonPayment', 'requestGlobalPayment', 'requestVirtualPayment'])
        .optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid order body', issues: parsed.error.issues });

    const tradeNo = genTradeNo();
    const totalAmount = parsed.data.totalAmount ?? 0;
    const pointsToUseRequested = parsed.data.pointsToUse ?? 0;
    let paymentMethod: string = parsed.data.paymentMethod || 'requestPayment';
    const payChannel = parsed.data.payChannel ?? 'wechat';
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

    let payInfo: Record<string, string> = {
      timeStamp: String(Math.floor(Date.now() / 1000)),
      nonceStr: crypto.randomBytes(12).toString('hex'),
      package: `prepay_id=mock_${tradeNo}`,
      signType: 'RSA',
      paySign: 'MOCK_PAY_SIGN',
    };
    let isMockPay = true;
    let transactionId = `TXN_${tradeNo}`;
    let channel: 'wechat' | 'alipay' = 'wechat';
    let alipayWebViewUrl: string | null = null;

    if (payChannel === 'alipay') {
      channel = 'alipay';
      paymentMethod = 'wapWebView';
      const useRealAli = userId && totalAmount > 0 && shouldUseRealAlipayPay(alipayPaymentMockMode, alipayWapConfig);
      if (useRealAli) {
        const host = String(req.get('host') || '').trim();
        const publicBase = String(process.env.API_PUBLIC_BASE_URL || '')
          .trim()
          .replace(/\/+$/, '') || (host ? `${req.protocol}://${host}` : '');
        if (!publicBase) {
          return res.status(503).json({
            ok: false,
            message:
              '支付宝手机网站支付需要可公网访问的 HTTPS 业务域名：请配置环境变量 API_PUBLIC_BASE_URL（例如 https://你的域名），并在小程序后台配置 web-view 业务域名。',
          });
        }
        const exp = Math.floor(Date.now() / 1000) + 30 * 60;
        const sig = signPayLaunch([tradeNo, String(exp), 'wap']);
        alipayWebViewUrl = `${publicBase}/api/alipay/wap-launch?orderNo=${encodeURIComponent(tradeNo)}&exp=${exp}&sig=${encodeURIComponent(sig)}`;
        isMockPay = false;
        transactionId = `ALIPAY_${tradeNo}`;
        payInfo = {};
      } else if (userId && totalAmount > 0 && !alipayPaymentMockMode && !alipayWapConfig) {
        return res.status(503).json({
          ok: false,
          message:
            '已关闭支付宝模拟（ALIPAY_PAY_MOCK=false），但未配置完整支付宝参数（ALIPAY_APP_ID、ALIPAY_APP_PRIVATE_KEY、ALIPAY_ALIPAY_PUBLIC_KEY、ALIPAY_NOTIFY_URL）。可选：ALIPAY_GATEWAY（默认正式网关）。',
        });
      }
    } else {
      channel = 'wechat';
      const useReal = userId && totalAmount > 0 && shouldUseRealWechatPay(paymentMockMode, wechatPayConfig);

      if (useReal) {
        const userRow = db.prepare(`SELECT openid FROM users WHERE id = ?`).get(userId) as { openid: string } | undefined;
        const openid = String(userRow?.openid || '').trim();
        if (!openid || /^dev_/i.test(openid)) {
          return res.status(400).json({
            ok: false,
            message:
              '真实支付需要微信登录用户 openid；开发用 dev_ 开头 openid 无法调起微信支付。请使用真机/体验版授权登录，或保持 WECHAT_PAY_MOCK=true。',
          });
        }
        try {
          const js = await jsapiTransactions({
            config: wechatPayConfig,
            description: `订单${tradeNo}`,
            outTradeNo: tradeNo,
            totalFen: totalAmount,
            openid,
          });
          payInfo = buildMiniProgramPayParams(wechatPayConfig.appId, js.prepay_id, wechatPayConfig.privateKeyPem);
          isMockPay = false;
          transactionId = js.prepay_id;
        } catch (e: any) {
          console.error('[wechat pay jsapi]', e);
          return res.status(502).json({ ok: false, message: String(e?.message || '微信下单失败') });
        }
      } else if (userId && totalAmount > 0 && !paymentMockMode && !wechatPayConfig) {
        return res.status(503).json({
          ok: false,
          message:
            '已关闭模拟支付（WECHAT_PAY_MOCK=false），但未配置完整微信支付参数（WECHAT_MCH_ID、WECHAT_PAY_SERIAL_NO、WECHAT_PAY_PRIVATE_KEY、WECHAT_PAY_NOTIFY_URL、WECHAT_PAY_API_V3_KEY）。',
        });
      }
    }

    return res.json({
      ok: true,
      data: {
        isSuccess: true,
        tradeNo,
        transactionId,
        interactId: `INT_${tradeNo}`,
        channel,
        payAmt: totalAmount,
        payInfo: JSON.stringify(payInfo),
        paymentMethod,
        pluginPaymentData: null,
        commonPayInfo: null,
        globalPayInfo: null,
        isMockPay,
        alipayWebViewUrl,
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
    const r = finalizeOrderPaid(orderNo, userId);
    if (!r.ok) {
      if (r.message === 'Order not found') return res.status(404).json({ ok: false, message: r.message });
      return res.status(409).json({ ok: false, message: r.message });
    }
    return res.json({ ok: true, data: { ok: true } });
  }

  async function wechatPayNotify(req: Request, res: Response) {
    if (!wechatPayConfig) {
      res.status(503).json({ code: 'FAIL', message: '未配置微信支付' });
      return;
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : String(req.body ?? '');
    const ts = String(req.headers['wechatpay-timestamp'] ?? '');
    const nonce = String(req.headers['wechatpay-nonce'] ?? '');
    const sig = String(req.headers['wechatpay-signature'] ?? '');
    const serial = String(req.headers['wechatpay-serial'] ?? '');

    if (wechatPayConfig.platformCertPem && sig && ts && nonce) {
      const ok = verifyNotifySignature({
        body: rawBody,
        timestamp: ts,
        nonce,
        signatureBase64: sig,
        platformCertPem: wechatPayConfig.platformCertPem,
      });
      if (!ok) {
        console.warn('[wechat pay notify] signature verify failed', { serial });
        res.status(401).json({ code: 'FAIL', message: 'sign' });
        return;
      }
    } else if (!wechatPayConfig.platformCertPem) {
      console.warn('[wechat pay notify] WECHAT_PAY_PLATFORM_CERT_PEM 未设置，跳过签名校验（生产务必配置）');
    }

    let payload: { resource?: { algorithm?: string; ciphertext?: string; nonce?: string; associated_data?: string } };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ code: 'FAIL', message: 'bad json' });
      return;
    }

    const resource = payload.resource;
    if (!resource || resource.algorithm !== 'AEAD_AES_256_GCM' || !resource.ciphertext || !resource.nonce) {
      res.status(400).json({ code: 'FAIL', message: 'bad resource' });
      return;
    }

    let plain: string;
    try {
      plain = decryptNotifyCiphertext(
        wechatPayConfig.apiV3Key,
        resource.associated_data ?? '',
        resource.nonce,
        resource.ciphertext,
      );
    } catch (e: any) {
      console.error('[wechat pay notify] decrypt', e);
      res.status(500).json({ code: 'FAIL', message: 'decrypt' });
      return;
    }

    let data: { out_trade_no?: string; trade_state?: string; amount?: { total?: number } };
    try {
      data = JSON.parse(plain);
    } catch {
      res.status(400).json({ code: 'FAIL', message: 'bad plaintext' });
      return;
    }

    if (data.trade_state !== 'SUCCESS') {
      res.json({ code: 'SUCCESS', message: '成功' });
      return;
    }

    const orderNo = String(data.out_trade_no || '').trim();
    if (!orderNo) {
      res.status(400).json({ code: 'FAIL', message: 'no out_trade_no' });
      return;
    }

    const order = db
      .prepare(`SELECT orderNo, paymentAmount FROM orders WHERE orderNo = ?`)
      .get(orderNo) as { orderNo: string; paymentAmount: number } | undefined;
    if (!order) {
      res.status(404).json({ code: 'FAIL', message: 'order' });
      return;
    }
    if (data.amount?.total != null && Number(data.amount.total) !== Number(order.paymentAmount)) {
      console.error('[wechat pay notify] amount mismatch', orderNo, data.amount?.total, order.paymentAmount);
      res.status(400).json({ code: 'FAIL', message: 'amount' });
      return;
    }

    const r = finalizeOrderPaid(orderNo);
    if (!r.ok) {
      console.warn('[wechat pay notify] finalize', orderNo, r);
      res.status(500).json({ code: 'FAIL', message: r.message });
      return;
    }

    res.json({ code: 'SUCCESS', message: '成功' });
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
    const st = Number(order.orderStatus ?? 0);
    if (st === 5) {
      return res.status(409).json({ ok: false, message: '订单尚未支付，无法申请退款；请取消订单或完成支付' });
    }
    if (st === 80) {
      return res.status(409).json({ ok: false, message: '订单已取消，无法退款' });
    }

    const refundAmount = Math.min(parsed.data.refundAmount ?? order.paymentAmount, order.paymentAmount);
    const paidLike =
      Number(order.orderStatus) === 10 ||
      Number(order.orderStatus) === 20 ||
      Number(order.orderStatus) === 40 ||
      Number(order.orderStatus) === 50;
    const txn = db.transaction(() => {
      if (paidLike) {
        restoreStockForOrderItems(db, String(order.itemsJson || '[]'));
      }
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
    });
    txn();

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

  function flattenUrlEncodedBody(body: unknown): Record<string, string> {
    const out: Record<string, string> = {};
    if (!body || typeof body !== 'object') return out;
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) {
      if (v === undefined || v === null) continue;
      out[String(k)] = Array.isArray(v) ? String(v[0]) : String(v);
    }
    return out;
  }

  async function alipayWapLaunch(req: Request, res: Response) {
    const orderNo = String(req.query.orderNo || '').trim();
    const exp = Number(req.query.exp || 0);
    const sig = String(req.query.sig || '').trim();
    if (!verifyWapLaunch(orderNo, exp, sig)) {
      return res.status(403).type('html').send('<html><meta charset="utf-8"><body>链接无效或已过期</body></html>');
    }
    const order = db
      .prepare(`SELECT orderNo, paymentAmount, orderStatus FROM orders WHERE orderNo = ?`)
      .get(orderNo) as { orderNo: string; paymentAmount: number; orderStatus: number } | undefined;
    if (!order || order.orderStatus !== 5) {
      return res.status(404).type('html').send('<html><meta charset="utf-8"><body>订单不可支付</body></html>');
    }
    if (!alipayWapConfig) {
      return res.status(503).type('html').send('<html><meta charset="utf-8"><body>未配置支付宝参数</body></html>');
    }
    try {
      const host = String(req.get('host') || '').trim();
      const publicBase = String(process.env.API_PUBLIC_BASE_URL || '')
        .trim()
        .replace(/\/+$/, '') || (host ? `${req.protocol}://${host}` : '');
      if (!publicBase) {
        return res.status(503).type('html').send('<html><meta charset="utf-8"><body>缺少 API_PUBLIC_BASE_URL</body></html>');
      }
      const sigRet = signPayLaunch([orderNo, 'return']);
      const sigQuit = signPayLaunch([orderNo, 'quit']);
      const returnUrl = `${publicBase}/api/alipay/return?orderNo=${encodeURIComponent(orderNo)}&sig=${encodeURIComponent(sigRet)}`;
      const quitUrl = `${publicBase}/api/alipay/quit?orderNo=${encodeURIComponent(orderNo)}&sig=${encodeURIComponent(sigQuit)}`;
      const html = await requestAlipayTradeWapPayHtml(alipayWapConfig, {
        outTradeNo: orderNo,
        totalFen: Number(order.paymentAmount || 0),
        subject: `订单${orderNo}`,
        notifyUrl: alipayWapConfig.notifyUrl,
        returnUrl,
        quitUrl,
      });
      return res.type('text/html; charset=utf-8').send(html);
    } catch (e: any) {
      console.error('[alipay wap launch]', e);
      const msg = String(e?.message || e);
      return res.status(502).type('html').send(`<html><meta charset="utf-8"><body>支付宝下单失败：${msg}</body></html>`);
    }
  }

  async function alipayNotify(req: Request, res: Response) {
    const params = flattenUrlEncodedBody(req.body);
    if (!alipayWapConfig) {
      return res.status(503).type('text/plain').send('fail');
    }
    if (!verifyAlipayNotifyParams(params, alipayWapConfig.alipayPublicKeyPem)) {
      console.warn('[alipay notify] verify failed');
      return res.status(400).type('text/plain').send('fail');
    }
    if (!isAlipayTradeSuccess(params)) {
      return res.type('text/plain').send('success');
    }
    const orderNo = String(params.out_trade_no || '').trim();
    if (!orderNo) return res.status(400).type('text/plain').send('fail');
    const order = db
      .prepare(`SELECT orderNo, paymentAmount, orderStatus FROM orders WHERE orderNo = ?`)
      .get(orderNo) as { orderNo: string; paymentAmount: number; orderStatus: number } | undefined;
    if (!order) {
      console.warn('[alipay notify] order not found', orderNo);
      return res.type('text/plain').send('success');
    }
    const notifyFen = Math.round(Number(params.total_amount || '0') * 100);
    if (notifyFen !== Number(order.paymentAmount)) {
      console.error('[alipay notify] amount mismatch', orderNo, notifyFen, order.paymentAmount);
      return res.status(400).type('text/plain').send('fail');
    }
    const r = finalizeOrderPaid(orderNo);
    if (!r.ok) {
      console.warn('[alipay notify] finalize', orderNo, r.message);
    }
    return res.type('text/plain').send('success');
  }

  function alipayReturn(req: Request, res: Response) {
    const orderNo = String(req.query.orderNo || '').trim();
    const sig = String(req.query.sig || '').trim();
    if (!verifyBridgeSig(orderNo, 'return', sig)) {
      return res.status(403).type('html').send('<html><meta charset="utf-8"><body>无效链接</body></html>');
    }
    const order = db
      .prepare(`SELECT orderNo, paymentAmount FROM orders WHERE orderNo = ?`)
      .get(orderNo) as { orderNo: string; paymentAmount: number } | undefined;
    const totalPaid = order ? Number(order.paymentAmount || 0) : 0;
    const safeOrderNo = JSON.stringify(orderNo);
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>
<p>正在返回小程序…</p>
<script src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"></script>
<script>
(function(){
  var orderNo = ${safeOrderNo};
  var totalPaid = ${totalPaid};
  if (typeof wx !== 'undefined' && wx.miniProgram) {
    wx.miniProgram.redirectTo({ url: '/pages/order/pay-result/index?orderNo=' + encodeURIComponent(orderNo) + '&totalPaid=' + encodeURIComponent(String(totalPaid)) + '&channel=alipay' });
  }
})();
</script>
</body></html>`;
    return res.type('text/html; charset=utf-8').send(html);
  }

  function alipayQuit(req: Request, res: Response) {
    const orderNo = String(req.query.orderNo || '').trim();
    const sig = String(req.query.sig || '').trim();
    if (!verifyBridgeSig(orderNo, 'quit', sig)) {
      return res.status(403).type('html').send('<html><meta charset="utf-8"><body>无效链接</body></html>');
    }
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head><body>
<p>已取消支付</p>
<script src="https://res.wx.qq.com/open/js/jweixin-1.6.0.js"></script>
<script>
if (typeof wx !== 'undefined' && wx.miniProgram) {
  wx.miniProgram.redirectTo({ url: '/pages/order/order-list/index' });
}
</script>
</body></html>`;
    return res.type('text/html; charset=utf-8').send(html);
  }

  return {
    commitOrder,
    wechatPayNotify,
    alipayWapLaunch,
    alipayNotify,
    alipayReturn,
    alipayQuit,
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
