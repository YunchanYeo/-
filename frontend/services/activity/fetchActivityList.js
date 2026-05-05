import { config } from '../../config/index';
function mockFetchActivityList(pageIndex = 1, pageSize = 20) {
    const { delay } = require('../_utils/delay');
    const { getActivityList } = require('../../model/activities');
    return delay().then(() => getActivityList(pageIndex, pageSize));
}
export function fetchActivityList(pageIndex = 1, pageSize = 20) {
    if (config.useMock)
        return mockFetchActivityList(pageIndex, pageSize);
    return Promise.resolve([]);
}
