import { config } from '../../../config/runtime';
import { requestJson } from '../../../services/_utils/http';
import { normalizeGoodsImageUrl } from '../../../services/_utils/normalizeGoodsImageUrl';

function mockFetchGoodDetailsCommentsCount(spuId = 0) {
    const { delay } = require('../../../services/_utils/delay');
    const { getGoodsDetailsCommentsCount } = require('../../../model/detailsComments');
    return delay().then(() => getGoodsDetailsCommentsCount(spuId));
}

export function getGoodsDetailsCommentsCount(spuId = 0) {
    if (config.useMock)
        return mockFetchGoodDetailsCommentsCount(spuId);
    const id = String(spuId || '').trim();
    if (!id)
        return Promise.resolve({
            badCount: 0,
            commentCount: 0,
            goodCount: 0,
            goodRate: 0,
            hasImageCount: 0,
            middleCount: 0,
        });
    return requestJson(`/api/products/${encodeURIComponent(id)}/reviews?limit=1&offset=0`, { method: 'GET' }).then((data) => {
        const s = data?.stats || {};
        return {
            badCount: Number(s.badCount || 0),
            commentCount: Number(s.commentCount || 0),
            goodCount: Number(s.goodCount || 0),
            goodRate: Number(s.goodRate || 0),
            hasImageCount: Number(s.hasImageCount || 0),
            middleCount: Number(s.middleCount || 0),
        };
    });
}

function mockFetchGoodDetailsCommentList(spuId = 0) {
    const { delay } = require('../../../services/_utils/delay');
    const { getGoodsDetailsComments } = require('../../../model/detailsComments');
    return delay().then(() => getGoodsDetailsComments(spuId));
}

export function getGoodsDetailsCommentList(spuId = 0) {
    if (config.useMock)
        return mockFetchGoodDetailsCommentList(spuId);
    const id = String(spuId || '').trim();
    if (!id)
        return Promise.resolve({ homePageComments: [] });
    return requestJson(`/api/products/${encodeURIComponent(id)}/reviews?limit=20&offset=0`, { method: 'GET' }).then((data) => {
        const list = Array.isArray(data?.homePageComments) ? data.homePageComments : [];
        return {
            homePageComments: list.map((item) => ({
                ...item,
                userHeadUrl: item.userHeadUrl ? normalizeGoodsImageUrl(item.userHeadUrl) : '',
            })),
        };
    });
}
