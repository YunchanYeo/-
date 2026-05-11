import { config } from '../../../../config/runtime';
function mockFetchComments(params) {
    const { delay } = require('../../../../services/_utils/delay');
    const { getGoodsAllComments } = require('../../../../model/comments');
    return delay().then(() => getGoodsAllComments(params));
}
export function fetchComments(params) {
    if (config.useMock)
        return mockFetchComments(params);
    return new Promise((resolve) => resolve('real api'));
}

