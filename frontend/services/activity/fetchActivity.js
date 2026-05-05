import { config } from '../../config/index';
function mockFetchActivity(ID = 0) {
    const { delay } = require('../_utils/delay');
    const { getActivity } = require('../../model/activity');
    return delay().then(() => getActivity(ID));
}
export function fetchActivity(ID = 0) {
    if (config.useMock)
        return mockFetchActivity(ID);
    return new Promise((resolve) => resolve('real api'));
}
