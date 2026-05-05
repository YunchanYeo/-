import { config } from '../../../config/index';
import { queryCommentDetail } from '../../../model/comments/queryDetail';
function mockQueryCommentDetail(params) {
    const { delay } = require('../../_utils/delay');
    const data = queryCommentDetail(params);
    return delay().then(() => data);
}
export function getCommentDetail(params) {
    if (config.useMock)
        return mockQueryCommentDetail(params);
    return new Promise((resolve) => resolve('real api'));
}
