import { config } from '../../../../config/runtime';
import { requestJson } from '../../../../services/_utils/http';

function mockFetchCommentsCount(ID = 0) {
    const { delay } = require('../../../../services/_utils/delay');
    const { getGoodsCommentsCount } = require('../../../../model/comments');
    return delay().then(() => getGoodsCommentsCount(ID));
}

export function fetchCommentsCount(opts) {
    if (config.useMock)
        return mockFetchCommentsCount(opts?.spuId);
    const spuId = String(opts?.spuId || '').trim();
    if (!spuId) {
        return Promise.resolve({
            badCount: '0',
            commentCount: '0',
            goodCount: '0',
            middleCount: '0',
            hasImageCount: '0',
            uidCount: '0',
        });
    }
    return requestJson(`/api/products/${encodeURIComponent(spuId)}/reviews?limit=1&offset=0`, { method: 'GET' }).then((data) => {
        const s = data?.stats || {};
        return {
            badCount: String(s.badCount ?? 0),
            commentCount: String(s.commentCount ?? 0),
            goodCount: String(s.goodCount ?? 0),
            middleCount: String(s.middleCount ?? 0),
            hasImageCount: String(s.hasImageCount ?? 0),
            uidCount: '0',
        };
    });
}
