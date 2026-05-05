import { config } from '../../config/index';
function mockFetchComments(params) {
    const { delay } = require('../_utils/delay');
    const { getGoodsAllComments } = require('../../model/comments');
    return delay().then(() => getGoodsAllComments(params));
}
export function fetchComments(params) {
    if (config.useMock)
        return mockFetchComments(params);
    return new Promise((resolve) => resolve('real api'));
}
