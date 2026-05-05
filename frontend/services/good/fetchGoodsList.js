/* eslint-disable no-param-reassign */
import { config, cdnBase } from '../../config/index';
import { requestJson } from '../_utils/http';
function normalizeImageUrl(image) {
    if (!image)
        return '';
    if (/^https?:\/\//i.test(image)) {
        // 后端历史数据可能写死 localhost/127.0.0.1，这里统一改成当前 apiBaseUrl 域名，避免缩略图加载失败。
        return String(image).replace(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i, config.apiBaseUrl);
    }
    if (String(image).startsWith('/'))
        return `${config.apiBaseUrl}${image}`;
    return `${config.apiBaseUrl}/${image}`;
}
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
        const fallbackThumb = `${cdnBase}/activity/banner.png`;
        return {
            spuList: rows.map((p) => ({
                spuId: String(p.id),
                thumb: p.thumb || normalizeImageUrl(p.image) || fallbackThumb,
                title: p.title,
                price: p.price,
                originPrice: p.originPrice || 0,
                desc: p.description || '',
                tags: p.category ? [p.category] : [],
                stock: Number(p.stock ?? 0),
            })),
            totalCount: rows.length,
        };
    });
}
