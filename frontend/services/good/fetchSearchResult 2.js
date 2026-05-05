/* eslint-disable no-param-reassign */
import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
function mockSearchResult(params) {
    const { delay } = require('../_utils/delay');
    const { getSearchResult } = require('../../model/search');
    const data = getSearchResult(params);
    if (data.spuList.length) {
        data.spuList.forEach((item) => {
            item.thumb = item.primaryImage;
            item.price = item.minSalePrice;
            item.originPrice = item.maxLinePrice;
            item.tags = item.spuTagList ? item.spuTagList.map((tag) => ({ title: tag.title })) : [];
        });
    }
    return delay().then(() => data);
}
export function getSearchResult(params) {
    if (config.useMock)
        return mockSearchResult(params);
    const keyword = String(params?.keyword || '').trim().toLowerCase();
    const minPrice = Number(params?.minPrice || 0);
    const maxPrice = params?.maxPrice === undefined ? null : Number(params.maxPrice);
    const sort = Number(params?.sort || 0);
    const sortType = Number(params?.sortType || 0);
    const pageNum = Math.max(1, Number(params?.pageNum || 1));
    const pageSize = Math.max(1, Number(params?.pageSize || 30));
    return requestJson('/api/products', { method: 'GET' }).then((rows) => {
        const normalizedRows = Array.isArray(rows) ? rows : [];
        let filtered = normalizedRows.filter((p) => {
            const title = String(p?.title || '').toLowerCase();
            const desc = String(p?.description || '').toLowerCase();
            const category = String(p?.category || '').toLowerCase();
            const matchesKeyword = !keyword || title.includes(keyword) || desc.includes(keyword) || category.includes(keyword);
            const price = Number(p?.price || 0);
            const matchesMin = price >= minPrice;
            const matchesMax = maxPrice === null || price <= maxPrice;
            return matchesKeyword && matchesMin && matchesMax;
        });
        if (sort === 1) {
            filtered = filtered.sort((a, b) => (sortType === 1 ? Number(b.price || 0) - Number(a.price || 0) : Number(a.price || 0) - Number(b.price || 0)));
        }
        else {
            filtered = filtered.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        }
        const totalCount = filtered.length;
        const start = (pageNum - 1) * pageSize;
        const pageRows = filtered.slice(start, start + pageSize);
        return {
            spuList: pageRows.map((p) => ({
                spuId: String(p.id),
                title: p.title || '',
                thumb: p.image || '',
                price: Number(p.price || 0),
                originPrice: Number(p.originPrice || 0),
                desc: p.description || '',
                spuTagList: p.category ? [{ title: p.category }] : [],
            })),
            totalCount,
        };
    });
}
