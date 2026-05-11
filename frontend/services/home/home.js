import { cdnBase } from '../../config/index';
import { requestJson } from '../_utils/http';
import { normalizeGoodsImageUrl } from '../_utils/normalizeGoodsImageUrl';
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
                return { text: name, key: idx, categoryId: Number.isFinite(id) ? id : null, categoryName: name };
            })
            : [{ text: '精选推荐', key: 0, categoryId: null, categoryName: '' }];
        const fallbackBanner = `${cdnBase}/activity/banner.png`;
        const swiper = safeProducts
            .map((p) => normalizeGoodsImageUrl(p?.image || p?.thumb || ''))
            .filter((x) => !!x)
            .slice(0, 6);
        const promoRows = Array.isArray(promotions) ? promotions : [];
        const promotionCards = promoRows.slice(0, 8).map((p) => ({
            spuId: p?.relatedProductId ? String(p.relatedProductId) : '',
            promotionId: String(p?.id || ''),
            title: String(p?.title || ''),
            image: normalizeGoodsImageUrl(p?.imageUrl || '') || fallbackBanner,
            price: 0,
            soldNum: 0,
        }));
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
            tabList,
            activityImg: fallbackBanner,
            hotProducts: promotionCards.length > 0 ? promotionCards : hotProducts,
        };
    });
}
