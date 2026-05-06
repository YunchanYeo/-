import { config, cdnBase } from '../../config/index';
import { requestJson } from '../_utils/http';
function normalizeImageUrl(image) {
    if (!image)
        return '';
    if (/^https?:\/\//i.test(image)) {
        // 后端历史数据可能写死 localhost/127.0.0.1，这里统一改成当前 apiBaseUrl 域名，避免首页缩略图加载失败。
        return String(image).replace(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i, config.apiBaseUrl);
    }
    if (String(image).startsWith('/'))
        return `${config.apiBaseUrl}${image}`;
    return `${config.apiBaseUrl}/${image}`;
}
function mockFetchGoodsList(pageIndex = 1, pageSize = 20) {
    const { delay } = require('../_utils/delay');
    const { getGoodsList } = require('../../model/goods');
    return delay().then(() => getGoodsList(pageIndex, pageSize).map((item) => ({
        spuId: item.spuId,
        thumb: item.primaryImage,
        title: item.title,
        price: item.minSalePrice,
        originPrice: item.maxLinePrice,
        tags: item.spuTagList.map((tag) => tag.title),
    })));
}
export function fetchGoodsList(pageIndex = 1, pageSize = 20) {
    if (config.useMock)
        return mockFetchGoodsList(pageIndex, pageSize);
    return requestJson('/api/products', { method: 'GET' }).then((rows) => {
        const fallbackThumb = `${cdnBase}/activity/banner.png`;
        const safeRows = Array.isArray(rows) ? rows : [];
        // pageIndex 视为从 0 开始的页码
        const offset = Math.max(0, Number(pageIndex) || 0) * Number(pageSize || 20);
        const page = safeRows.slice(offset, offset + Number(pageSize || 20));
        return page.map((p) => ({
            spuId: String(p.id),
            thumb: p.thumb || normalizeImageUrl(p.image) || fallbackThumb,
            title: p.title,
            desc: p.description || '',
            price: p.price,
            originPrice: p.originPrice || 0,
            tags: p.category ? [p.category] : [],
            stock: Number(p.stock ?? 0),
        }));
    });
}
