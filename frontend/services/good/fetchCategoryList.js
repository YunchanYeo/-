import { config } from '../../config/runtime';
import { requestJson } from '../_utils/http';
function mockFetchGoodCategory() {
    const { delay } = require('../_utils/delay');
    const { getCategoryList } = require('../../model/category');
    return delay().then(() => getCategoryList());
}
export function getCategoryList() {
    if (config.useMock)
        return mockFetchGoodCategory();
    return requestJson('/api/categories', { method: 'GET' });
}
