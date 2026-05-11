import { config } from '../../../config/runtime';
import { mockIp, mockReqId } from './mock';
import { requestJson } from '../../../services/_utils/http';
import { normalizeGoodsImageUrl } from '../../../services/_utils/normalizeGoodsImageUrl';
function mockFetchSettleDetail(params) {
    const { delay } = require('../../../services/_utils/delay');
    const { genSettleDetail } = require('../../../model/order/orderConfirm');
    return delay().then(() => genSettleDetail(params));
}
async function realFetchSettleDetail(params = {}) {
    const goodsRequestList = Array.isArray(params.goodsRequestList) ? params.goodsRequestList : [];
    const userAddressReq = params.userAddressReq || null;
    const selectedCouponIds = Array.isArray(params.couponList)
        ? params.couponList.map((c) => Number(c.couponId || c.id)).filter((n) => Number.isFinite(n))
        : [];
    const usePoints = !!params.usePoints;
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
        const imageRaw = goods.primaryImage || goods.thumb || goods.image || product?.image || '';
        const image = normalizeGoodsImageUrl(imageRaw);
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
    let availableCoupons = [];
    try {
        availableCoupons = await requestJson('/api/coupons?status=default', { method: 'GET' });
    }
    catch (_) {
        availableCoupons = [];
    }
    const couponRows = Array.isArray(availableCoupons) ? availableCoupons : [];
    const couponById = new Map(couponRows.map((c) => [Number(c.couponId || c.id), c]));
    const selectedCoupons = selectedCouponIds.map((id) => couponById.get(id)).filter(Boolean);
    const selectedReduce = selectedCoupons.reduce((sum, c) => {
        const type = c.type === 'discount' ? 'discount' : 'price';
        if (type === 'price') {
            return sum + Number(c.value || 0);
        }
        return sum;
    }, 0);
    const storeGoodsList = Object.values(storeMap).map((store) => {
        const storeTotalPayAmount = store.skuDetailVos.reduce((sum, g) => sum + g.settlePrice * g.quantity, 0);
        return { ...store, storeTotalPayAmount, couponList: couponRows };
    });
    const totalGoodsCount = goodsWithPrice.reduce((sum, g) => sum + g.quantity, 0);
    const totalSalePrice = goodsWithPrice.reduce((sum, g) => sum + g.settlePrice * g.quantity, 0);
    const totalDeliveryFee = 0;
    const totalPromotionAmount = 0;
    const totalCouponAmount = Math.min(selectedReduce, totalSalePrice);
    let availablePoints = 0;
    let pointsThreshold = 1000;
    try {
        const me = await requestJson('/api/me', { method: 'GET' });
        availablePoints = Number(me?.points || 0);
        const policy = await requestJson('/api/points/config', { method: 'GET' });
        pointsThreshold = Math.max(0, Math.floor(Number(policy?.pointsUseThreshold || 1000)));
    }
    catch (_) {
        availablePoints = 0;
        pointsThreshold = 1000;
    }
    const canUsePoints = availablePoints >= pointsThreshold;
    const basePayAmount = totalSalePrice + totalDeliveryFee - totalPromotionAmount - totalCouponAmount;
    const pointsDiscount = usePoints && canUsePoints ? Math.min(availablePoints, basePayAmount) : 0;
    const totalPayAmount = Math.max(0, basePayAmount - pointsDiscount);
    return {
        data: {
            storeGoodsList,
            outOfStockGoodsList: [],
            abnormalDeliveryGoodsList: [],
            inValidGoodsList: [],
            limitGoodsList: [],
            couponList: couponRows,
            totalCouponCount: couponRows.length,
            userAddress: userAddressReq,
            totalGoodsCount,
            totalSalePrice,
            totalDeliveryFee,
            totalPromotionAmount,
            totalCouponAmount,
            availablePoints,
            pointsDiscount,
            pointsThreshold,
            usePointsApplied: pointsDiscount > 0,
            totalAmount: totalPayAmount,
            totalPayAmount,
            settleType: totalGoodsCount > 0 ? 1 : 0,
            invoiceSupport: true,
        },
    };
}
function mockDispatchCommitPay(params = {}) {
    const { delay } = require('../../../services/_utils/delay');
    const payChannel = params.payChannel === 'alipay' ? 'alipay' : 'wechat';
    return delay().then(() => ({
        data: {
            isSuccess: true,
            tradeNo: '350930961469409099',
            payInfo: '{}',
            code: null,
            transactionId: payChannel === 'alipay' ? 'ALIPAY_MOCK' : 'E-200915180100299000',
            msg: null,
            interactId: '15145',
            channel: payChannel,
            paymentMethod: payChannel === 'alipay' ? 'wapWebView' : 'requestPayment',
            alipayWebViewUrl: null,
            isMockPay: true,
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
export function deriveGoodsRequestListFromSettleDetail(settleData) {
    const data = settleData && typeof settleData === 'object' ? settleData : {};
    const stores = Array.isArray(data.storeGoodsList) ? data.storeGoodsList : [];
    const list = [];
    stores.forEach((store) => {
        const skus = Array.isArray(store.skuDetailVos) ? store.skuDetailVos : [];
        skus.forEach((sku) => {
            const img = String(sku.image || '').trim();
            list.push({
                storeId: store.storeId ?? sku.storeId,
                storeName: store.storeName || sku.storeName || '默认门店',
                skuId: sku.skuId,
                spuId: sku.spuId,
                quantity: sku.quantity,
                price: sku.settlePrice,
                settlePrice: sku.settlePrice,
                goodsName: sku.goodsName,
                title: sku.goodsName,
                primaryImage: img,
                image: img,
                thumb: img,
                specInfo: Array.isArray(sku.skuSpecLst)
                    ? sku.skuSpecLst.map((x) => ({ specValue: x.specValue || '' }))
                    : [],
            });
        });
    });
    return list;
}
export function dispatchSupplementInvoice() {
    if (config.useMock) {
        const { delay } = require('../../../services/_utils/delay');
        return delay();
    }
    return new Promise((resolve) => resolve('real api'));
}

