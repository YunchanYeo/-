import { requestJson } from '../../../services/_utils/http';
import { normalizeGoodsImageUrl } from '../../../services/_utils/normalizeGoodsImageUrl';

function buildRightsNo(orderNo) {
    return `refund_${orderNo}`;
}

function buildLogisticsNodes(order) {
    if (!order?.logisticsNo)
        return [];
    return [
        {
            title: '已发货',
            icon: 'deliver',
            desc: `${order.logisticsCompanyName || '快递公司'} 已揽收，运单号 ${order.logisticsNo}`,
            date: order.shippedAt || order.createdAt || '',
        },
    ];
}

function mapOrderToRights(order) {
    const items = Array.isArray(order?.items) ? order.items : [];
    const storeName = items?.[0]?.storeName || '默认门店';
    const rightsNo = buildRightsNo(order.orderNo);
    const logisticsVO = {
        logisticsNo: order.logisticsNo || '',
        logisticsCompanyName: order.logisticsCompanyName || '',
        logisticsCompanyCode: order.logisticsCompanyCode || '',
        remark: order.logisticsRemark || '',
        nodes: buildLogisticsNodes(order),
    };
    return {
        buttonVOs: logisticsVO.logisticsNo
            ? [{ name: '查看物流', primary: false, type: 5 }]
            : [],
        storeId: items?.[0]?.storeId || '1',
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
        logisticsVO,
    };
}

export function getRightsList({ parameter: { afterServiceStatus = -1, pageNum = 1, pageSize = 10 } = {} }) {
    return requestJson('/api/orders', { method: 'GET' }).then((rows) => {
        const all = (Array.isArray(rows) ? rows : [])
            .filter((row) => Number(row?.refundStatus) === 1)
            .map(mapOrderToRights);
        const filtered = afterServiceStatus > -1 ? all.filter((x) => x.rights.rightsStatus === afterServiceStatus) : all;
        const start = Math.max(0, (Number(pageNum) - 1) * Number(pageSize));
        const dataList = filtered.slice(start, start + Number(pageSize));
        return {
            data: {
                pageNum: Number(pageNum),
                pageSize: Number(pageSize),
                totalCount: filtered.length,
                states: {
                    audit: 0,
                    approved: 0,
                    complete: filtered.length,
                    closed: 0,
                },
                dataList,
            },
        };
    });
}
