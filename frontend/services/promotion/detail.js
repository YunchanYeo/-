import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
function mockFetchPromotion(ID = 0) {
    const { delay } = require('../_utils/delay');
    const { getPromotion } = require('../../model/promotion');
    return delay().then(() => getPromotion(ID));
}
export function fetchPromotion(ID = 0) {
    if (config.useMock)
        return mockFetchPromotion(ID);
    return requestJson(`/api/promotions/${ID}`, { method: 'GET' }).then((row) => {
        const list = row?.relatedProduct
            ? [{
                spuId: String(row.relatedProduct.id),
                title: row.relatedProduct.title || '',
                thumb: row.relatedProduct.image || '',
                price: Number(row.relatedProduct.price || 0),
                originPrice: Number(row.relatedProduct.originPrice || 0),
                tags: [{ title: row.relatedProduct.category || '' }].filter((x) => x.title),
            }]
            : [];
        return {
            list,
            banner: row?.imageUrl || '',
            time: 0,
            showBannerDesc: true,
            statusTag: '',
            description: String(row?.description || ''),
            title: String(row?.title || ''),
        };
    });
}
