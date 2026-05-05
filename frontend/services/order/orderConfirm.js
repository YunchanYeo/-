import { config } from '../../config/index';
import { mockIp, mockReqId } from '../../utils/mock';
import { requestJson } from '../_utils/http';
function mockFetchSettleDetail(params) {
    const { delay } = require('../_utils/delay');
    const { genSettleDetail } = require('../../model/order/orderConfirm');
    return delay().then(() => genSettleDetail(params));
}
async function realFetchSettleDetail(params = {}) {
    const goodsRequestList = Array.isArray(params.goodsRequestList) ? params.goodsRequestList : [];
    const userAddressReq = params.userAddressReq || null;
    const goodsWithPrice = await Promise.all(goodsRequestList.map(async (goods, index) => {
        let product = null;
        const spuId = goods.spuId || goods.id;
        if (spuId) {
            try {
                product = await requestJson(`/api/products/${spuId}`, { method: 'GET' });
            }
            catch (e) {
                product = null;
            }
        }
        const quantity = Number(goods.quantity || 1);
        const settlePrice = Number(goods.price ?? goods.settlePrice ?? product?.price ?? 0);
        const image = goods.primaryImage || goods.thumb || goods.image || product?.image || '';
        const goodsName = goods.goodsName || goods.title || product?.title || '商品';
        const skuSpecLst = Array.isArray(goods.specInfo) ? goods.specInfo.map((spec) => ({ specValue: spec.specValue || '' })) : [];
        return {
            index,
            storeId: String(goods.storeId || '1'),
            storeName: goods.storeName || '默认门店',
            skuId: goods.skuId || `sku_${spuId || index}`,
            spuId: spuId || `spu_${index}`,
            quantity,
            settlePrice,
            tagPrice: settlePrice,
            image,
            goodsName,
            skuSpecLst,
        };
    }));
    const storeMap = {};
    goodsWithPrice.forEach((item) => {
        if (!storeMap[item.storeId]) {
            storeMap[item.storeId] = { storeId: item.storeId, storeName: item.storeName, skuDetailVos: [], couponList: [] };
        }
        storeMap[item.storeId].skuDetailVos.push(item);
    });
    const storeGoodsList = Object.values(storeMap).map((store) => {
        const storeTotalPayAmount = store.skuDetailVos.reduce((sum, g) => sum + g.settlePrice * g.quantity, 0);
        return { ...store, storeTotalPayAmount };
    });
    const totalGoodsCount = goodsWithPrice.reduce((sum, g) => sum + g.quantity, 0);
    const totalSalePrice = goodsWithPrice.reduce((sum, g) => sum + g.settlePrice * g.quantity, 0);
    const totalDeliveryFee = 0;
    const totalPromotionAmount = 0;
    const totalCouponAmount = 0;
    const totalPayAmount = totalSalePrice + totalDeliveryFee - totalPromotionAmount - totalCouponAmount;
    return {
        data: {
            storeGoodsList,
            outOfStockGoodsList: [],
            abnormalDeliveryGoodsList: [],
            inValidGoodsList: [],
            limitGoodsList: [],
            couponList: [],
            userAddress: userAddressReq,
            totalGoodsCount,
            totalSalePrice,
            totalDeliveryFee,
            totalPromotionAmount,
            totalCouponAmount,
            totalAmount: totalPayAmount,
            totalPayAmount,
            settleType: totalGoodsCount > 0 ? 1 : 0,
            invoiceSupport: true,
        },
    };
}
function mockDispatchCommitPay() {
    const { delay } = require('../_utils/delay');
    return delay().then(() => ({
        data: {
            isSuccess: true,
            tradeNo: '350930961469409099',
            payInfo: '{}',
            code: null,
            transactionId: 'E-200915180100299000',
            msg: null,
            interactId: '15145',
            channel: 'wechat',
            limitGoodsList: null,
        },
        code: 'Success',
        msg: null,
        requestId: mockReqId(),
        clientIp: mockIp(),
        rt: 891,
        success: true,
    }));
}
export function fetchSettleDetail(params) {
    if (config.useMock)
        return mockFetchSettleDetail(params);
    return realFetchSettleDetail(params);
}
export function dispatchCommitPay(params) {
    if (config.useMock)
        return mockDispatchCommitPay(params);
    return requestJson('/api/orders/commit', { method: 'POST', data: params }).then((data) => ({
        data,
        code: 'Success',
        msg: null,
        requestId: mockReqId(),
        clientIp: mockIp(),
        rt: 0,
        success: true,
    }));
}
export function dispatchSupplementInvoice() {
    if (config.useMock) {
        const { delay } = require('../_utils/delay');
        return delay();
    }
    return new Promise((resolve) => resolve('real api'));
}
