import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
function mockFetchRightsPreview(params) {
    const { delay } = require('../_utils/delay');
    const { genRightsPreview } = require('../../model/order/applyService');
    return delay().then(() => genRightsPreview(params));
}
export function fetchRightsPreview(params) {
    if (config.useMock)
        return mockFetchRightsPreview(params);
    return requestJson(`/api/orders/${params.orderNo}`, { method: 'GET' }).then((order) => {
        const firstItem = (order.items || [])[0] || {};
        const refundable = Number(order.paymentAmount || order.totalAmount || 0);
        return {
            data: {
                skuId: params.skuId || firstItem.skuId || '',
                spuId: params.spuId || firstItem.spuId || '',
                goodsInfo: {
                    skuImage: firstItem.primaryImage || firstItem.thumb || firstItem.image || '',
                    goodsName: firstItem.goodsName || firstItem.title || '商品',
                    specInfo: Array.isArray(firstItem.specInfo) ? firstItem.specInfo : [],
                },
                paidAmountEach: refundable,
                boughtQuantity: Number(firstItem.quantity || 1),
                refundableAmount: refundable,
                shippingFeeIncluded: 0,
                numOfSku: Number(firstItem.quantity || 1),
                numOfSkuAvailable: Number(firstItem.quantity || 1),
            },
        };
    });
}
export function dispatchConfirmReceived(params) {
    if (config.useMock) {
        const { delay } = require('../_utils/delay');
        return delay();
    }
    const orderNo = params?.parameter?.orderNo;
    return requestJson(`/api/orders/${orderNo}/confirm`, { method: 'POST' }).then((data) => ({ data }));
}
function mockFetchApplyReasonList(params) {
    const { delay } = require('../_utils/delay');
    const { genApplyReasonList } = require('../../model/order/applyService');
    return delay().then(() => genApplyReasonList(params));
}
export function fetchApplyReasonList(params) {
    if (config.useMock)
        return mockFetchApplyReasonList(params);
    return Promise.resolve({
        data: {
            rightsReasonList: [
                { id: 1, desc: '不想要了' },
                { id: 2, desc: '商品与描述不符' },
                { id: 3, desc: '质量问题' },
            ],
        },
    });
}
function mockDispatchApplyService(params) {
    const { delay } = require('../_utils/delay');
    const { applyService } = require('../../model/order/applyService');
    return delay().then(() => applyService(params));
}
export function dispatchApplyService(params) {
    if (config.useMock)
        return mockDispatchApplyService(params);
    const orderNo = params?.rights?.orderNo;
    const refundAmount = Number(params?.rights?.refundRequestAmount || 0);
    const reason = params?.rights?.rightsReasonDesc || '';
    return requestJson(`/api/orders/${orderNo}/refund`, {
        method: 'POST',
        data: { refundAmount, reason },
    }).then((data) => ({
        data: {
            rightsNo: '',
            refundOrderNo: data.orderNo,
        },
    }));
}
