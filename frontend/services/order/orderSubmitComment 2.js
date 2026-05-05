import { config } from '../../config/index';
function mockGetGoods(parameter) {
    const { delay } = require('../_utils/delay');
    const { getGoods } = require('../../model/submitComment');
    const data = getGoods(parameter);
    return delay().then(() => data);
}
export function getGoods(parameter) {
    if (config.useMock)
        return mockGetGoods(parameter);
    return new Promise((resolve) => resolve('real api'));
}
