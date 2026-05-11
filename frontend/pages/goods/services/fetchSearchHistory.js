import { config } from '../../../config/runtime';
import { requestJson } from '../../../services/_utils/http';
function mockSearchHistory() {
    const { delay } = require('../../../services/_utils/delay');
    const { getSearchHistory } = require('../../../model/search');
    return delay().then(() => getSearchHistory());
}
export function getSearchHistory() {
    if (config.useMock)
        return mockSearchHistory();
    return Promise.resolve({ historyWords: [] });
}
function mockSearchPopular() {
    const { delay } = require('../../../services/_utils/delay');
    const { getSearchPopular } = require('../../../model/search');
    return delay().then(() => getSearchPopular());
}
export function getSearchPopular() {
    if (config.useMock)
        return mockSearchPopular();
    return requestJson('/api/products', { method: 'GET' })
        .then((rows) => {
        const safeRows = Array.isArray(rows) ? rows : [];
        const popularWords = safeRows
            .sort((a, b) => {
            const soldDiff = Number(b?.soldNum || 0) - Number(a?.soldNum || 0);
            if (soldDiff !== 0)
                return soldDiff;
            return Number(b?.id || 0) - Number(a?.id || 0);
        })
            .slice(0, 10)
            .map((p) => String(p?.title || '').trim())
            .filter((x) => !!x);
        return { popularWords };
    })
        .catch(() => ({ popularWords: [] }));
}

