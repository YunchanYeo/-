/* eslint-disable no-param-reassign */
import { config, cdnBase } from '../../config/runtime';
import { requestJson } from '../_utils/http';
import { normalizeGoodsImageUrl } from '../_utils/normalizeGoodsImageUrl';
function mockFetchGoodsList(params) {
    const { delay } = require('../_utils/delay');
    const { getSearchResult } = require('../../model/search');
    const data = getSearchResult(params);
    if (data.spuList.length) {
        data.spuList.forEach((item) => {
            item.thumb = item.primaryImage;
            item.price = item.minSalePrice;
            item.originPrice = item.maxLinePrice;
            item.desc = '';
            item.tags = item.spuTagList ? item.spuTagList.map((tag) => tag.title) : [];
        });
    }
    return delay().then(() => data);
}
export function fetchGoodsList(params) {
    if (config.useMock)
        return mockFetchGoodsList(params);
    const category = params?.category ? `?category=${encodeURIComponent(params.category)}` : '';
    return requestJson(`/api/products${category}`, { method: 'GET' }).then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const fallbackThumb = `${cdnBase}/activity/banner.png`;
        return {
            spuList: list.map((p) => ({
                spuId: String(p.id),
                thumb: p.thumb || normalizeGoodsImageUrl(p.image) || fallbackThumb,
                title: p.title,
                price: p.price,
                originPrice: p.originPrice || 0,
                desc: p.description || '',
                tags: p.category ? [p.category] : [],
                stock: Number(p.stock ?? 0),
            })),
            totalCount: list.length,
        };
    });
}
