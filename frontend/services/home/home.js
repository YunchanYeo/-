import { cdnBase } from '../../config/runtime';
import { requestJson } from '../_utils/http';
import { normalizeGoodsImageUrl } from '../_utils/normalizeGoodsImageUrl';
const DEFAULT_CATEGORY_THUMB_BY_NAME = {
    零食: 'https://img.icons8.com/color/240/potato-chips.png',
    面: 'https://img.icons8.com/color/240/noodles.png',
    饮料: 'https://img.icons8.com/color/240/water-bottle.png',
    饭: 'https://img.icons8.com/color/240/rice-bowl.png',
    罐头: 'https://img.icons8.com/color/240/tin-can.png',
    糖果: 'https://img.icons8.com/color/240/candy.png',
};
const FALLBACK_CATEGORY_THUMB = 'https://img.icons8.com/color/240/shopping-basket-2.png';
function resolveCategoryThumb(categoryRow, name) {
    const fromApi = normalizeGoodsImageUrl(categoryRow?.thumb || categoryRow?.thumbnail || '');
    if (fromApi)
        return fromApi;
    return DEFAULT_CATEGORY_THUMB_BY_NAME[name] || FALLBACK_CATEGORY_THUMB;
}
function mockFetchHome() {
    const { delay } = require('../_utils/delay');
    const { genSwiperImageList } = require('../../model/swiper');
    return delay().then(() => ({
        swiper: genSwiperImageList(),
        tabList: [
            { text: '精选推荐', key: 0 },
            { text: '夏日防晒', key: 1 },
            { text: '二胎大作战', key: 2 },
            { text: '人气榜', key: 3 },
            { text: '好评榜', key: 4 },
            { text: 'RTX 30', key: 5 },
            { text: '手机也疯狂', key: 6 },
        ],
        activityImg: `${cdnBase}/activity/banner.png`,
    }));
}
export function fetchHome() {
    return Promise.all([
        requestJson('/api/categories', { method: 'GET' }).catch(() => []),
        requestJson('/api/products', { method: 'GET' }).catch(() => []),
        requestJson('/api/promotions', { method: 'GET' }).catch(() => []),
    ]).then(([categories, products, promotions]) => {
        const safeCategories = Array.isArray(categories) ? categories : [];
        const safeProducts = Array.isArray(products) ? products : [];
        const tabList = safeCategories.length > 0
            ? safeCategories.map((c, idx) => {
                const name = String(c?.name || c?.title || c?.label || `分类${idx + 1}`);
                const id = c?.id == null ? null : Number(c.id);
                return {
                    text: name,
                    key: idx,
                    categoryId: Number.isFinite(id) ? id : null,
                    categoryName: name,
                    thumb: resolveCategoryThumb(c, name),
                };
            })
            : [{ text: '精选推荐', key: 0, categoryId: null, categoryName: '' }];
        const fallbackBanner = `${cdnBase}/activity/banner.png`;
        const bannerProducts = safeProducts.slice(0, 6);
        const bannerItems = bannerProducts
            .map((p) => {
            const image = normalizeGoodsImageUrl(p?.image || p?.thumb || '') || fallbackBanner;
            return {
                image,
                spuId: String(p?.id || ''),
            };
        })
            .filter((b) => !!b.image);
        const swiper = bannerItems.map((b) => b.image);
        const promoRows = Array.isArray(promotions) ? promotions : [];
        const productById = new Map(safeProducts.map((p) => [String(p?.id ?? '').trim(), p]));
        const promotionCards = promoRows.slice(0, 8).map((p) => {
            const relatedId = p?.relatedProductId != null && p.relatedProductId !== '' ? String(p.relatedProductId).trim() : '';
            const prod = relatedId ? productById.get(relatedId) : null;
            const promoImg = normalizeGoodsImageUrl(p?.imageUrl || '') || fallbackBanner;
            if (prod) {
                const cover = normalizeGoodsImageUrl(prod?.image || prod?.thumb || '') || promoImg;
                return {
                    spuId: relatedId,
                    promotionId: String(p?.id || ''),
                    title: String(prod?.title || p?.title || ''),
                    image: cover,
                    price: Number(prod?.price || 0),
                    soldNum: Number(prod?.soldNum || 0),
                };
            }
            return {
                spuId: relatedId,
                promotionId: String(p?.id || ''),
                title: String(p?.title || ''),
                image: promoImg,
                price: 0,
                soldNum: 0,
            };
        });
        const hotProducts = [...safeProducts]
            .sort((a, b) => {
                const soldDiff = Number(b?.soldNum || 0) - Number(a?.soldNum || 0);
                if (soldDiff !== 0)
                    return soldDiff;
                return Number(b?.id || 0) - Number(a?.id || 0);
            })
            .slice(0, 8)
            .map((p) => ({
                spuId: String(p?.id || ''),
                title: String(p?.title || ''),
                image: normalizeGoodsImageUrl(p?.image || p?.thumb || '') || fallbackBanner,
                price: Number(p?.price || 0),
                soldNum: Number(p?.soldNum || 0),
            }));
        return {
            swiper: swiper.length > 0 ? swiper : [fallbackBanner],
            bannerItems: bannerItems.length > 0 ? bannerItems : [{ image: fallbackBanner, spuId: '' }],
            tabList,
            activityImg: fallbackBanner,
            hotProducts: promotionCards.length > 0 ? promotionCards : hotProducts,
        };
    });
}
