import { config } from '../../config/index';
function mockSearchHistory() {
    const { delay } = require('../_utils/delay');
    const { getSearchHistory } = require('../../model/search');
    return delay().then(() => getSearchHistory());
}
export function getSearchHistory() {
    if (config.useMock)
        return mockSearchHistory();
    return new Promise((resolve) => resolve('real api'));
}
function mockSearchPopular() {
    const { delay } = require('../_utils/delay');
    const { getSearchPopular } = require('../../model/search');
    return delay().then(() => getSearchPopular());
}
export function getSearchPopular() {
    if (config.useMock)
        return mockSearchPopular();
    return new Promise((resolve) => resolve('real api'));
}
