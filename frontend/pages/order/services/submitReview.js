import { requestJson } from '../../../services/_utils/http';

/**
 * 订单完成后提交商品评价
 * @param {string} orderNo
 * @param {{ productId: number, score: number, content?: string, isAnonymous?: boolean, skuId?: string }} body
 */
export function submitOrderReview(orderNo, body) {
    const no = String(orderNo || '').trim();
    if (!no)
        return Promise.reject(new Error('缺少订单号'));
    return requestJson(`/api/orders/${encodeURIComponent(no)}/reviews`, { method: 'POST', data: body });
}
