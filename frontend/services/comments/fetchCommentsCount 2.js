import { config } from '../../config/index';
function mockFetchCommentsCount(ID = 0) {
    const { delay } = require('../_utils/delay');
    const { getGoodsCommentsCount } = require('../../model/comments');
    return delay().then(() => getGoodsCommentsCount(ID));
}
export function fetchCommentsCount(ID = 0) {
    if (config.useMock)
        return mockFetchCommentsCount(ID);
    return new Promise((resolve) => resolve('real api'));
}
