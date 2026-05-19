import { config, cdnBase } from '../../config/runtime';
import { requestJson } from '../_utils/http';
import { normalizeGoodsImageUrl } from '../_utils/normalizeGoodsImageUrl';
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
    const opts = arguments.length >= 3 ? arguments[2] : null;
    const categoryId = opts && typeof opts === 'object' && opts.categoryId != null ? Number(opts.categoryId) : null;
    const categoryName = opts && typeof opts === 'object' && opts.categoryName != null ? String(opts.categoryName).trim() : '';
    // 优先按分类名筛选：后端会同时匹配 category 文本与 categoryId；仅传 id 时未回填 categoryId 的商品会漏掉
    const qs = categoryName
        ? `?category=${encodeURIComponent(categoryName)}`
        : (Number.isFinite(categoryId) && categoryId > 0
            ? `?categoryId=${encodeURIComponent(String(categoryId))}`
            : '');
    return requestJson(`/api/products${qs}`, { method: 'GET' }).then((rows) => {
        const fallbackThumb = `${cdnBase}/activity/banner.png`;
        const safeRows = Array.isArray(rows) ? rows : [];
        // pageIndex 视为从 0 开始的页码
        const offset = Math.max(0, Number(pageIndex) || 0) * Number(pageSize || 20);
        const page = safeRows.slice(offset, offset + Number(pageSize || 20));
        return page.map((p) => ({
            spuId: String(p.id),
            thumb: p.thumb || normalizeGoodsImageUrl(p.image) || fallbackThumb,
            title: p.title,
            desc: p.description || '',
            price: p.price,
            originPrice: p.originPrice || 0,
            tags: p.category ? [p.category] : [],
            stock: Number(p.stock ?? 0),
        }));
    });
}
