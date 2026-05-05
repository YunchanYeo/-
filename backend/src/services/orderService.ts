import crypto from 'node:crypto';
import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Db } from '../types';

function genTradeNo() {
  const ts = Date.now();
  const rand = crypto.randomInt(100000, 999999);
  return `${ts}${rand}`;
}

export function createOrderService({ db, paymentMockMode }: { db: Db; paymentMockMode: boolean }) {
  function commitOrder(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const schema = z.object({
      totalAmount: z.number().nonnegative().optional(),
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
    const paymentMethod = parsed.data.paymentMethod || 'requestPayment';
    const orderItems = parsed.data.goodsRequestList ?? [];
    const orderAddress = (req.body as any)?.userAddressReq ?? {};

    if (userId) {
      db.prepare(
        `INSERT INTO orders (
          orderNo, userId, totalAmount, paymentAmount, refundAmount, refundStatus, orderStatus, orderStatusName,
          itemsJson, addressJson, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ).run(tradeNo, userId, totalAmount, totalAmount, 0, 0, 10, '待发货', JSON.stringify(orderItems), JSON.stringify(orderAddress));
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

  function listOrders(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const rows = db
      .prepare(
        `SELECT id, orderNo, totalAmount, paymentAmount, refundAmount, refundStatus, refundReason, refundedAt,
                orderStatus, orderStatusName, itemsJson, addressJson, createdAt,
                logisticsCompanyCode, logisticsCompanyName, logisticsNo, logisticsRemark, shippedAt
         FROM orders
         WHERE userId = ?
         ORDER BY id DESC`,
      )
      .all(userId);
    const data = rows.map((row: any) => ({ ...row, items: JSON.parse(row.itemsJson || '[]'), address: JSON.parse(row.addressJson || '{}') }));
    return res.json({ ok: true, data });
  }

  function ordersCount(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const total = (db.prepare(`SELECT COUNT(*) as c FROM orders WHERE userId = ?`).get(userId) as any)?.c ?? 0;
    return res.json({
      ok: true,
      data: [
        { tabType: -1, orderNum: total },
        { tabType: 10, orderNum: total },
        { tabType: 20, orderNum: 0 },
        { tabType: 30, orderNum: 0 },
        { tabType: 40, orderNum: 0 },
      ],
    });
  }

  function getOrderDetail(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const row = db
      .prepare(
        `SELECT id, orderNo, totalAmount, paymentAmount, refundAmount, refundStatus, refundReason, refundedAt,
                orderStatus, orderStatusName, itemsJson, addressJson, createdAt,
                logisticsCompanyCode, logisticsCompanyName, logisticsNo, logisticsRemark, shippedAt
         FROM orders
         WHERE userId = ? AND orderNo = ?`,
      )
      .get(userId, req.params.orderNo);
    if (!row) return res.status(404).json({ ok: false, message: 'Order not found' });
    const r: any = row;
    return res.json({ ok: true, data: { ...r, items: JSON.parse(r.itemsJson || '[]'), address: JSON.parse(r.addressJson || '{}') } });
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
      data: { ...updated, items: JSON.parse(updated.itemsJson || '[]'), address: JSON.parse(updated.addressJson || '{}') },
    });
  }

  return { commitOrder, listOrders, ordersCount, getOrderDetail, refundOrder };
}
