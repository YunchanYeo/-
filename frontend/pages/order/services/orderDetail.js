import { config } from '../../../config/runtime';
import { requestJson } from '../../../services/_utils/http';
import { fetchCustomerServicePhone } from '../../../services/_utils/customerServicePhone';
import { normalizeGoodsImageUrl } from '../../../services/_utils/normalizeGoodsImageUrl';
import { OrderButtonTypes, OrderStatus } from '../config';
function mockFetchOrderDetail(params) {
    const { delay } = require('../../../services/_utils/delay');
    const { genOrderDetail } = require('../../../model/order/orderDetail');
    return delay().then(() => genOrderDetail(params));
}
export function fetchOrderDetail(params) {
    if (config.useMock)
        return mockFetchOrderDetail(params);
    const orderNo = params?.parameter;
    return requestJson(`/api/orders/${orderNo}`, { method: 'GET' }).then((row) => {
        const items = Array.isArray(row.items) ? row.items : [];
        const address = row.address || {};
        const hasShipping = !!row.logisticsNo;
        const shippedAt = row.shippedAt ? new Date(row.shippedAt).getTime() : 0;
        const reviewedSet = new Set((row.reviewedProductIds || []).map((x) => Number(x)));
        return {
            data: {
                orderId: row.id,
                orderNo: row.orderNo,
                parentOrderNo: '',
                storeId: Number(items[0]?.storeId || 1),
                storeName: items[0]?.storeName || '默认门店',
                orderStatus: row.orderStatus,
                orderStatusName: row.orderStatusName,
                paymentAmount: row.refundStatus ? 0 : row.paymentAmount,
                goodsAmountApp: row.totalAmount,
                createTime: new Date(row.createdAt).getTime(),
                logisticsVO: {
                    logisticsNo: row.logisticsNo || '',
                    receiverName: address.name || '',
                    receiverPhone: address.phone || '',
                    receiverCity: address.cityName || '',
                    receiverCountry: address.districtName || '',
                    receiverArea: '',
                    receiverAddress: address.detailAddress || '',
                    logisticsCompanyName: row.logisticsCompanyName || '',
                    logisticsCompanyTel: '',
                },
                orderItemVOs: items.map((g, index) => {
                    const spuIdStr = String(g.spuId ?? '').trim();
                    const pid = parseInt(spuIdStr, 10);
                    const hasReview = Number.isFinite(pid) ? reviewedSet.has(pid) : false;
                    const lineButtons = [];
                    if (Number(row.orderStatus) === OrderStatus.COMPLETE && !row.refundStatus && Number.isFinite(pid) && !hasReview) {
                        lineButtons.push({ name: '评价', primary: true, type: OrderButtonTypes.COMMENT });
                    }
                    return {
                    id: index + 1,
                    goodsPictureUrl: normalizeGoodsImageUrl(g.primaryImage || g.thumb || g.image || ''),
                    goodsName: g.goodsName || g.title || '商品',
                    skuId: g.skuId || '',
                    spuId: g.spuId || '',
                    specifications: Array.isArray(g.specInfo) ? g.specInfo.map((s) => ({ specValue: s.specValue || '' })) : [],
                    actualPrice: Number(g.price || g.settlePrice || 0),
                    buyQuantity: Number(g.quantity || 1),
                    buttonVOs: lineButtons,
                };
                }),
                buttonVOs: buildButtonsByOrder(row),
                paymentVO: { paySuccessTime: row.refundStatus ? 0 : new Date(row.createdAt).getTime() },
                invoiceStatus: 3,
                invoiceDesc: '',
                invoiceVO: null,
                trajectoryVos: hasShipping
                    ? [
                        {
                            title: '物流信息',
                            code: 'transport',
                            nodes: [
                                {
                                    status: `${row.logisticsCompanyName || '快递公司'} 已揽收，运单号 ${row.logisticsNo}`,
                                    timestamp: shippedAt || Date.now(),
                                },
                            ],
                        },
                    ]
                    : [],
            },
        };
    });
}
function mockFetchBusinessTime(params) {
    const { delay } = require('../../../services/_utils/delay');
    const { genBusinessTime } = require('../../../model/order/orderDetail');
    return delay().then(() => genBusinessTime(params));
}
export function fetchBusinessTime(params) {
    if (config.useMock)
        return mockFetchBusinessTime(params);
    return fetchCustomerServicePhone().then((telphone) => ({
        data: {
            telphone,
            businessTime: ['09:00-18:00'],
        },
    }));
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
        return [
            { name: '删除订单', primary: true, type: OrderButtonTypes.DELETE },
            { name: '申请售后', primary: false, type: OrderButtonTypes.APPLY_REFUND },
            { name: '再次购买', primary: true, type: OrderButtonTypes.REBUY },
        ];
    }
    if (status === OrderStatus.PENDING_DELIVERY) {
        return [{ name: '申请售후', primary: false, type: OrderButtonTypes.APPLY_REFUND }];
    }
    if (status === OrderStatus.CANCELED_NOT_PAYMENT) {
        return [
            { name: '删除订单', primary: true, type: OrderButtonTypes.DELETE },
            { name: '再次购买', primary: true, type: OrderButtonTypes.REBUY },
        ];
    }
    return [{ name: '申请售后', primary: false, type: OrderButtonTypes.APPLY_REFUND }];
}

