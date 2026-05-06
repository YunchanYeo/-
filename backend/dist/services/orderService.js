import crypto from 'node:crypto';
import { z } from 'zod';
import { hydrateOrderItemsWithProduct } from './orderItemImages';
function genTradeNo() {
    const ts = Date.now();
    const rand = crypto.randomInt(100000, 999999);
    return `${ts}${rand}`;
}
export function createOrderService({ db, paymentMockMode }) {
    function commitOrder(req, res) {
        const userId = req.user?.id;
        const schema = z.object({
            totalAmount: z.number().nonnegative().optional(),
            goodsRequestList: z.array(z.any()).optional(),
            userName: z.string().optional(),
            paymentMethod: z
                .enum(['requestPayment', 'requestPluginPayment', 'requestCommonPayment', 'requestGlobalPayment', 'requestVirtualPayment'])
                .optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid order body', issues: parsed.error.issues });
        const tradeNo = genTradeNo();
        const totalAmount = parsed.data.totalAmount ?? 0;
        const paymentMethod = parsed.data.paymentMethod || 'requestPayment';
        const orderItemsRaw = parsed.data.goodsRequestList ?? [];
        const orderItems = hydrateOrderItemsWithProduct(db, orderItemsRaw);
        const orderAddress = req.body?.userAddressReq ?? {};
        if (userId) {
            db.prepare(`INSERT INTO orders (
          orderNo, userId, totalAmount, paymentAmount, refundAmount, refundStatus, orderStatus, orderStatusName,
          itemsJson, addressJson, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run(tradeNo, userId, totalAmount, totalAmount, 0, 0, 10, '待发货', JSON.stringify(orderItems), JSON.stringify(orderAddress));
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
    function listOrders(req, res) {
        const userId = req.user?.id;
        const rows = db
            .prepare(`SELECT id, orderNo, totalAmount, paymentAmount, refundAmount, refundStatus, refundReason, refundedAt,
                orderStatus, orderStatusName, itemsJson, addressJson, createdAt,
                logisticsCompanyCode, logisticsCompanyName, logisticsNo, logisticsRemark, shippedAt
         FROM orders
         WHERE userId = ?
         ORDER BY id DESC`)
            .all(userId);
        const data = rows.map((row) => ({
            ...row,
            items: hydrateOrderItemsWithProduct(db, JSON.parse(row.itemsJson || '[]')),
            address: JSON.parse(row.addressJson || '{}'),
        }));
        return res.json({ ok: true, data });
    }
    function ordersCount(req, res) {
        const userId = req.user?.id;
        const c = (sql) => (db.prepare(sql).get(userId)?.n ?? 0);
        const total = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ?`);
        const pendingPay = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ? AND orderStatus = 5`);
        const pendingDelivery = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ? AND orderStatus = 10`);
        const pendingReceipt = c(`SELECT COUNT(*) as n FROM orders WHERE userId = ? AND orderStatus IN (20, 40)`);
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
    function getOrderDetail(req, res) {
        const userId = req.user?.id;
        const row = db
            .prepare(`SELECT id, orderNo, totalAmount, paymentAmount, refundAmount, refundStatus, refundReason, refundedAt,
                orderStatus, orderStatusName, itemsJson, addressJson, createdAt,
                logisticsCompanyCode, logisticsCompanyName, logisticsNo, logisticsRemark, shippedAt
         FROM orders
         WHERE userId = ? AND orderNo = ?`)
            .get(userId, req.params.orderNo);
        if (!row)
            return res.status(404).json({ ok: false, message: 'Order not found' });
        const r = row;
        return res.json({
            ok: true,
            data: {
                ...r,
                items: hydrateOrderItemsWithProduct(db, JSON.parse(r.itemsJson || '[]')),
                address: JSON.parse(r.addressJson || '{}'),
            },
        });
    }
    function refundOrder(req, res) {
        const userId = req.user?.id;
        const schema = z.object({ reason: z.string().optional(), refundAmount: z.number().int().nonnegative().optional() });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid refund body', issues: parsed.error.issues });
        const order = db.prepare(`SELECT * FROM orders WHERE userId = ? AND orderNo = ?`).get(userId, req.params.orderNo);
        if (!order)
            return res.status(404).json({ ok: false, message: 'Order not found' });
        if (order.refundStatus === 1)
            return res.status(409).json({ ok: false, message: 'Order already refunded' });
        const refundAmount = Math.min(parsed.data.refundAmount ?? order.paymentAmount, order.paymentAmount);
        db.prepare(`UPDATE orders
       SET refundStatus = 1,
           refundAmount = ?,
           refundReason = ?,
           refundedAt = datetime('now'),
           orderStatus = 50,
           orderStatusName = '已完成',
           updatedAt = datetime('now')
       WHERE id = ?`).run(refundAmount, parsed.data.reason ?? '', order.id);
        const updated = db
            .prepare(`SELECT id, orderNo, totalAmount, paymentAmount, refundAmount, refundStatus, refundReason, refundedAt,
                orderStatus, orderStatusName, itemsJson, addressJson, createdAt
         FROM orders WHERE id = ?`)
            .get(order.id);
        return res.json({
            ok: true,
            data: {
                ...updated,
                items: hydrateOrderItemsWithProduct(db, JSON.parse(updated.itemsJson || '[]')),
                address: JSON.parse(updated.addressJson || '{}'),
            },
        });
    }
    return { commitOrder, listOrders, ordersCount, getOrderDetail, refundOrder };
}
