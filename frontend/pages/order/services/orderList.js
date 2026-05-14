import { config } from '../../../config/runtime';
import { requestJson } from '../../../services/_utils/http';
import { normalizeGoodsImageUrl } from '../../../services/_utils/normalizeGoodsImageUrl';
import { OrderButtonTypes, OrderStatus, ORDER_BUTTON_APPLY_REFUND_NAME } from '../config';

function productIdFromOrderLineItem(g) {
    const raw = g?.spuId ?? g?.productId ?? g?.spu_id;
    if (typeof raw === 'number' && Number.isFinite(raw))
        return raw;
    const s = String(raw ?? '').trim();
    if (!s)
        return null;
    const legacy = /^spu_(\d+)$/i.exec(s);
    if (legacy?.[1]) {
        const n = parseInt(legacy[1], 10);
        return Number.isFinite(n) ? n : null;
    }
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
}
function mockFetchOrders(params) {
    const { delay } = require('../../../services/_utils/delay');
    const { genOrders } = require('../../../model/order/orderList');
    return delay(200).then(() => genOrders(params));
}
export function fetchOrders(params) {
    if (config.useMock)
        return mockFetchOrders(params);
    const status = params?.parameter?.orderStatus;
    return requestJson('/api/orders', { method: 'GET' }).then((rows) => {
        const filtered = typeof status === 'number' && status !== -1
            ? rows.filter((o) => {
                if (status === 40)
                    return o.orderStatus === 40 || o.orderStatus === 20;
                if (status === OrderStatus.PENDING_REVIEW)
                    return o.orderStatus === OrderStatus.COMPLETE && o.needsReview;
                if (status === OrderStatus.COMPLETE)
                    return o.orderStatus === OrderStatus.COMPLETE && !o.needsReview;
                return o.orderStatus === status;
            })
            : rows;
        const orders = filtered.map((row) => {
            const items = Array.isArray(row.items) ? row.items : [];
            const buttons = buildButtonsByOrder(row);
            return {
                orderId: row.id,
                orderNo: row.orderNo,
                parentOrderNo: '',
                storeId: Number(items[0]?.storeId || 1),
                storeName: items[0]?.storeName || '默认门店',
                orderStatus: row.orderStatus,
                orderStatusName: row.orderStatusName,
                needsReview: !!row.needsReview,
                reviewedProductIds: Array.isArray(row.reviewedProductIds) ? row.reviewedProductIds : [],
                paymentAmount: row.refundStatus ? 0 : row.paymentAmount,
                totalAmount: row.totalAmount,
                freightFee: 0,
                logisticsVO: { logisticsNo: '' },
                createTime: new Date(row.createdAt).getTime(),
                orderItemVOs: items.map((g, index) => {
                    const pid = productIdFromOrderLineItem(g);
                    return {
                        id: index + 1,
                        goodsPictureUrl: normalizeGoodsImageUrl(g.primaryImage || g.thumb || g.image || ''),
                        goodsName: g.goodsName || g.title || '商品',
                        skuId: g.skuId || '',
                        spuId: pid != null ? String(pid) : String(g.spuId || ''),
                        productId: pid,
                        specifications: Array.isArray(g.specInfo) ? g.specInfo.map((s) => ({ specValue: s.specValue || '' })) : [],
                        actualPrice: Number(g.price || g.settlePrice || 0),
                        buyQuantity: Number(g.quantity || 1),
                    };
                }),
                buttonVOs: buttons,
            };
        });
        return { data: { orders } };
    });
}
function mockFetchOrdersCount(params) {
    const { delay } = require('../../../services/_utils/delay');
    const { genOrdersCount } = require('../../../model/order/orderList');
    return delay().then(() => genOrdersCount(params));
}
export function fetchOrdersCount(params) {
    if (config.useMock)
        return mockFetchOrdersCount(params);
    return requestJson('/api/orders/count', { method: 'GET' }).then((data) => ({ data }));
}
function buildButtonsByOrder(row) {
    if (Number(row?.refundStatus) === 1) {
        return [{ name: '查看退款', primary: false, type: OrderButtonTypes.VIEW_REFUND }];
    }
    const status = Number(row?.orderStatus || 0);
    if (status === OrderStatus.PENDING_PAYMENT) {
        return [
            { name: '取消订单', primary: false, type: OrderButtonTypes.CANCEL },
            { name: '去支付', primary: true, type: OrderButtonTypes.PAY },
        ];
    }
    if (status === OrderStatus.PENDING_RECEIPT || status === 20) {
        return [
            { name: '查看物流', primary: false, type: OrderButtonTypes.DELIVERY },
            { name: '确认收货', primary: true, type: OrderButtonTypes.CONFIRM },
        ];
    }
    if (status === OrderStatus.COMPLETE) {
        const right = [
            { name: '删除订单', primary: true, type: OrderButtonTypes.DELETE },
            { name: ORDER_BUTTON_APPLY_REFUND_NAME, primary: false, type: OrderButtonTypes.APPLY_REFUND },
            { name: '再次购买', primary: true, type: OrderButtonTypes.REBUY },
        ];
        if (row.needsReview) {
            right.unshift({ name: '评价', primary: true, type: OrderButtonTypes.COMMENT });
        }
        return right;
    }
    if (status === OrderStatus.PENDING_DELIVERY) {
        return [{ name: ORDER_BUTTON_APPLY_REFUND_NAME, primary: false, type: OrderButtonTypes.APPLY_REFUND }];
    }
    if (status === OrderStatus.CANCELED_NOT_PAYMENT) {
        return [
            { name: '删除订单', primary: true, type: OrderButtonTypes.DELETE },
            { name: '再次购买', primary: true, type: OrderButtonTypes.REBUY },
        ];
    }
    return [{ name: ORDER_BUTTON_APPLY_REFUND_NAME, primary: false, type: OrderButtonTypes.APPLY_REFUND }];
}

