import { config } from '../../../config/runtime';
function mockFetchGoodDetailsCommentsCount(spuId = 0) {
    const { delay } = require('../../../services/_utils/delay');
    const { getGoodsDetailsCommentsCount } = require('../../../model/detailsComments');
    return delay().then(() => getGoodsDetailsCommentsCount(spuId));
}
export function getGoodsDetailsCommentsCount(spuId = 0) {
    if (config.useMock)
        return mockFetchGoodDetailsCommentsCount(spuId);
    return new Promise((resolve) => resolve('real api'));
}
function mockFetchGoodDetailsCommentList(spuId = 0) {
    const { delay } = require('../../../services/_utils/delay');
    const { getGoodsDetailsComments } = require('../../../model/detailsComments');
    return delay().then(() => getGoodsDetailsComments(spuId));
}
export function getGoodsDetailsCommentList(spuId = 0) {
    if (config.useMock)
        return mockFetchGoodDetailsCommentList(spuId);
    return new Promise((resolve) => resolve('real api'));
}

