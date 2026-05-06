import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
import { normalizeGoodsImageUrl } from '../_utils/normalizeGoodsImageUrl';
function mockFetchOrders(params) {
    const { delay } = require('../_utils/delay');
    const { genOrders } = require('../../model/order/orderList');
    return delay(200).then(() => genOrders(params));
}
export function fetchOrders(params) {
    if (config.useMock)
        return mockFetchOrders(params);
    const status = params?.parameter?.orderStatus;
    return requestJson('/api/orders', { method: 'GET' }).then((rows) => {
        const filtered =
            typeof status === 'number' && status !== -1
                ? rows.filter((o) => {
                      if (status === 40)
                          return o.orderStatus === 40 || o.orderStatus === 20;
                      return o.orderStatus === status;
                  })
                : rows;
        const orders = filtered.map((row) => {
            const items = Array.isArray(row.items) ? row.items : [];
            return {
                orderId: row.id,
                orderNo: row.orderNo,
                parentOrderNo: '',
                storeId: Number(items[0]?.storeId || 1),
                storeName: items[0]?.storeName || '默认门店',
                orderStatus: row.orderStatus,
                orderStatusName: row.orderStatusName,
                paymentAmount: row.refundStatus ? 0 : row.paymentAmount,
                totalAmount: row.totalAmount,
                freightFee: 0,
                logisticsVO: { logisticsNo: '' },
                createTime: new Date(row.createdAt).getTime(),
                orderItemVOs: items.map((g, index) => ({
                    id: index + 1,
                    goodsPictureUrl: normalizeGoodsImageUrl(g.primaryImage || g.thumb || g.image || ''),
                    goodsName: g.goodsName || g.title || '商品',
                    skuId: g.skuId || '',
                    spuId: g.spuId || '',
                    specifications: Array.isArray(g.specInfo) ? g.specInfo.map((s) => ({ specValue: s.specValue || '' })) : [],
                    actualPrice: Number(g.price || g.settlePrice || 0),
                    buyQuantity: Number(g.quantity || 1),
                })),
                buttonVOs: row.refundStatus ? [{ name: '查看退款', primary: false, type: 5 }] : [{ name: '申请售后', primary: false, type: 4 }],
            };
        });
        return { data: { orders } };
    });
}
function mockFetchOrdersCount(params) {
    const { delay } = require('../_utils/delay');
    const { genOrdersCount } = require('../../model/order/orderList');
    return delay().then(() => genOrdersCount(params));
}
export function fetchOrdersCount(params) {
    if (config.useMock)
        return mockFetchOrdersCount(params);
    return requestJson('/api/orders/count', { method: 'GET' }).then((data) => ({ data }));
}
