import dayjs from 'dayjs';
import { requestJson } from '../../../services/_utils/http';
import { normalizeGoodsImageUrl } from '../../../services/_utils/normalizeGoodsImageUrl';

export const formatTime = (date, template) => dayjs(date).format(template);

function parseOrderNoFromRightsNo(rightsNo) {
    const raw = String(rightsNo || '').trim();
    if (raw.startsWith('refund_'))
        return raw.slice('refund_'.length);
    return raw;
}

function toRightsDetail(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const storeName = items?.[0]?.storeName || '默认门店';
    const rightsNo = `refund_${order.orderNo}`;
    const logisticsVO = {
        logisticsNo: order.logisticsNo || '',
        logisticsCompanyName: order.logisticsCompanyName || '',
        logisticsCompanyCode: order.logisticsCompanyCode || '',
        remark: order.logisticsRemark || '',
        receiverName: '',
        receiverPhone: '',
        receiverProvince: '',
        receiverCity: '',
        receiverCountry: '',
        receiverArea: '',
        receiverAddress: '',
        nodes: order.logisticsNo
            ? [
                {
                    title: '已发货',
                    icon: 'deliver',
                    desc: `${order.logisticsCompanyName || '快递公司'} 已揽收，运单号 ${order.logisticsNo}`,
                    date: order.shippedAt || order.createdAt || '',
                },
            ]
            : [],
    };
    return {
        buttonVOs: logisticsVO.logisticsNo ? [{ name: '查看物流', primary: false, type: 5 }] : [],
        rights: {
            rightsNo,
            orderNo: order.orderNo,
            storeName,
            rightsType: 20,
            rightsStatus: 50,
            userRightsStatus: 160,
            userRightsStatusName: '已退款',
            userRightsStatusDesc: '商家已退款，退回资金将原路返回您的账户',
            rightsReasonDesc: order.refundReason || '用户申请退款',
            refundRequestAmount: Number(order.refundAmount || order.paymentAmount || 0),
            afterSaleRequireType: 'REFUND_MONEY',
            createTime: new Date(order.createdAt || Date.now()).getTime(),
            rightsImageUrls: [],
        },
        rightsItem: items.map((item, i) => ({
            id: i + 1,
            skuId: item.skuId || '',
            goodsName: item.goodsName || item.title || '商品',
            goodsPictureUrl: normalizeGoodsImageUrl(item.primaryImage || item.thumb || item.image || ''),
            itemRefundAmount: Number(item.price || item.settlePrice || 0) * Number(item.quantity || 1),
            rightsQuantity: Number(item.quantity || 1),
            specInfo: Array.isArray(item.specInfo)
                ? item.specInfo.map((s) => ({ specValues: s.specValue || '' }))
                : [],
        })),
        rightsRefund: {
            refundAmount: Number(order.refundAmount || order.paymentAmount || 0),
            refundDesc: order.refundReason || '用户申请退款',
            traceNo: order.orderNo,
        },
        refundMethodList: [
            {
                refundMethodAmount: Number(order.refundAmount || order.paymentAmount || 0),
                refundMethodName: '微信支付',
            },
        ],
        logisticsVO,
    };
}

export function getRightsDetail({ rightsNo }) {
    const orderNo = parseOrderNoFromRightsNo(rightsNo);
    return requestJson(`/api/orders/${encodeURIComponent(orderNo)}`, { method: 'GET' }).then((row) => ({
        data: [toRightsDetail(row)],
    }));
}
export function cancelRights() {
    return Promise.resolve({ data: {} });
}
