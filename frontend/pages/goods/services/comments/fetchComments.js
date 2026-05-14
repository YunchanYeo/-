import { config } from '../../../../config/runtime';
import { requestJson } from '../../../../services/_utils/http';
import { normalizeGoodsImageUrl } from '../../../../services/_utils/normalizeGoodsImageUrl';

function mockFetchComments(params) {
    const { delay } = require('../../../../services/_utils/delay');
    const { getGoodsAllComments } = require('../../../../model/comments');
    return delay().then(() => getGoodsAllComments(params));
}

export function fetchComments(params) {
    if (config.useMock)
        return mockFetchComments(params);
    const spuId = String(params?.queryParameter?.spuId || '').trim();
    const pageNum = Math.max(1, Number(params?.pageNum) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params?.pageSize) || 30));
    if (!spuId)
        return Promise.resolve({ pageList: [], totalCount: 0 });
    const offset = (pageNum - 1) * pageSize;
    return requestJson(`/api/products/${encodeURIComponent(spuId)}/reviews?limit=${pageSize}&offset=${offset}`, {
        method: 'GET',
    }).then((data) => {
        const raw = Array.isArray(data?.homePageComments) ? data.homePageComments : [];
        const pageList = raw.map((item) => ({
            ...item,
            commentTime: item.createdAt ? Date.parse(item.createdAt) : Date.now(),
            userHeadUrl: item.isAnonymity
                ? 'https://tdesign.gtimg.com/mobile/demos/avatar1.jpeg'
                : item.userHeadUrl
                    ? normalizeGoodsImageUrl(item.userHeadUrl)
                    : 'https://tdesign.gtimg.com/mobile/demos/avatar1.jpeg',
            commentResources: [],
        }));
        return { pageList, totalCount: Number(data?.total ?? pageList.length) };
    });
}
