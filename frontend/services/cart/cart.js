import { config } from '../../config/runtime';
import { requestJson } from '../_utils/http';
import { normalizeGoodsImageUrl } from '../_utils/normalizeGoodsImageUrl';
function mockFetchCartGroupData(params) {
    const { delay } = require('../_utils/delay');
    const { genCartGroupData } = require('../../model/cart');
    return delay().then(() => genCartGroupData(params));
}
const CART_STORAGE_KEY = 'local.cart.items';
function readLocalCartItems() {
    const items = wx.getStorageSync(CART_STORAGE_KEY);
    return Array.isArray(items) ? items : [];
}
function writeLocalCartItems(items) {
    wx.setStorageSync(CART_STORAGE_KEY, items);
}
function mutateLocalCartItems(mutator) {
    const items = readLocalCartItems();
    const next = mutator(Array.isArray(items) ? [...items] : []);
    writeLocalCartItems(next);
    return next;
}
function toCartGroupData(items) {
    const goodsPromotionList = items.map((item) => ({
        title: item.title,
        goodsName: item.title,
        thumb: normalizeGoodsImageUrl(item.thumb),
        primaryImage: normalizeGoodsImageUrl(item.thumb),
        image: normalizeGoodsImageUrl(item.thumb),
        price: item.price,
        settlePrice: item.price,
        quantity: item.quantity,
        stockQuantity: item.stockQuantity || 9999,
        isSelected: item.isSelected ?? 1,
        spuId: item.spuId,
        skuId: item.skuId,
        storeId: item.storeId,
        storeName: item.storeName || '默认门店',
        specInfo: item.specInfo || [],
        tagText: '',
    }));
    const totalAmount = goodsPromotionList
        .filter((g) => g.isSelected === 1)
        .reduce((sum, g) => sum + Number(g.price || 0) * Number(g.quantity || 0), 0);
    const selectedGoodsCount = goodsPromotionList
        .filter((g) => g.isSelected === 1)
        .reduce((sum, g) => sum + Number(g.quantity || 0), 0);
    return {
        storeGoods: [
            {
                storeId: '1',
                storeName: '默认门店',
                promotionGoodsList: [
                    {
                        promotionId: 'normal',
                        goodsPromotionList,
                    },
                ],
                shortageGoodsList: [],
            },
        ],
        invalidGoodItems: [],
        totalAmount,
        selectedGoodsCount,
        totalDiscountAmount: 0,
        isAllSelected: goodsPromotionList.length > 0 && goodsPromotionList.every((g) => g.isSelected === 1),
    };
}

/**
 * 使用后端商品数据刷新本地购物车快照，保证价格/库存/标题/图片与数据库一致。
 * 仅覆盖商品主数据，不改变用户本地选择状态和数量。
 * @param {Array<Record<string, any>>} items
 * @returns {Promise<Array<Record<string, any>>>}
 */
async function syncCartItemsWithServer(items) {
    if (!Array.isArray(items) || items.length === 0)
        return [];
    if (config.useMock)
        return items;
    try {
        const rows = await requestJson('/api/products', { method: 'GET' });
        const byId = new Map((Array.isArray(rows) ? rows : []).map((p) => [String(p.id), p]));
        return items.map((item) => {
            const p = byId.get(String(item.spuId));
            if (!p) {
                // 商品已下架或不存在时标记为无库存，避免继续下单。
                return { ...item, stockQuantity: 0 };
            }
            const latestThumb = normalizeGoodsImageUrl(p.image || item.thumb || '');
            return {
                ...item,
                title: p.title || item.title || '商品',
                thumb: latestThumb,
                price: Number(p.price ?? item.price ?? 0),
                stockQuantity: Number(p.stock ?? item.stockQuantity ?? 0),
            };
        });
    }
    catch (e) {
        return items;
    }
}
export function fetchCartGroupData(params) {
    const items = readLocalCartItems();
    // 兼容旧数据：把历史存储里的图片 URL 统一迁移成当前 apiBaseUrl 域名，避免购物车图片加载失败。
    const migrated = items.map((it) => ({ ...it, thumb: normalizeGoodsImageUrl(it.thumb || '') }));
    if (migrated.length > 0) {
        return syncCartItemsWithServer(migrated).then((synced) => {
            writeLocalCartItems(synced);
            return { data: toCartGroupData(synced) };
        });
    }
    if (config.useMock)
        return mockFetchCartGroupData(params);
    writeLocalCartItems(migrated);
    return Promise.resolve({ data: toCartGroupData(migrated) });
}
export function addItemToLocalCart(goods) {
    const items = readLocalCartItems();
    const spuId = String(goods.spuId || goods.id || '');
    const skuId = String(goods.skuId || goods.spuId || goods.id || '');
    const found = items.find((i) => i.spuId === spuId && i.skuId === skuId);
    if (found) {
        found.quantity += 1;
    }
    else {
        const rawThumb = goods.thumb || goods.primaryImage || goods.image || '';
        items.push({
            spuId,
            skuId,
            storeId: String(goods.storeId || '1'),
            storeName: goods.storeName || '默认门店',
            title: goods.title || goods.goodsName || '商品',
            thumb: normalizeGoodsImageUrl(rawThumb),
            price: Number(goods.price || 0),
            quantity: 1,
            isSelected: 1,
            stockQuantity: Number(goods.stock || goods.stockQuantity || 9999),
            specInfo: Array.isArray(goods.specInfo) ? goods.specInfo : [],
        });
    }
    writeLocalCartItems(items);
    return items;
}
export function updateLocalCartItemSelection({ spuId, skuId, isSelected }) {
    return mutateLocalCartItems((items) => {
        items.forEach((item) => {
            if (String(item.spuId) === String(spuId) && String(item.skuId) === String(skuId)) {
                item.isSelected = isSelected ? 1 : 0;
            }
        });
        return items;
    });
}
export function updateLocalCartItemQuantity({ spuId, skuId, quantity }) {
    return mutateLocalCartItems((items) => {
        items.forEach((item) => {
            if (String(item.spuId) === String(spuId) && String(item.skuId) === String(skuId)) {
                item.quantity = Math.max(1, Number(quantity || 1));
            }
        });
        return items;
    });
}
export function deleteLocalCartItem({ spuId, skuId }) {
    return mutateLocalCartItems((items) => items.filter((item) => !(String(item.spuId) === String(spuId) && String(item.skuId) === String(skuId))));
}
export function clearLocalInvalidCartItems() {
    return readLocalCartItems();
}
export function updateLocalCartStoreSelection({ storeId, isSelected }) {
    return mutateLocalCartItems((items) => {
        items.forEach((item) => {
            if (String(item.storeId || '1') === String(storeId || '1')) {
                item.isSelected = isSelected ? 1 : 0;
            }
        });
        return items;
    });
}

/**
 * 结算成功后，从本地购物车中移除已购买商品（按 spuId+skuId 匹配）。
 * @param {Array<Record<string, any>>} purchasedGoods
 * @returns {Array<Record<string, any>>}
 */
export function removePurchasedFromLocalCart(purchasedGoods) {
    if (!Array.isArray(purchasedGoods) || purchasedGoods.length === 0) {
        return readLocalCartItems();
    }
    const keySet = new Set(purchasedGoods.map((g) => `${String(g.spuId || '')}__${String(g.skuId || '')}`));
    return mutateLocalCartItems((items) => items.filter((item) => !keySet.has(`${String(item.spuId || '')}__${String(item.skuId || '')}`)));
}
