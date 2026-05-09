import { config } from '../../config/index';
import { requestJson } from '../_utils/http';
import { normalizeGoodsImageUrl } from '../_utils/normalizeGoodsImageUrl';
function mockFetchGood(ID = 0) {
    const { delay } = require('../_utils/delay');
    const { genGood } = require('../../model/good');
    return delay().then(() => genGood(ID));
}
export function fetchGood(ID = 0) {
    if (config.useMock)
        return mockFetchGood(ID);
    return requestJson(`/api/products/${ID}`, { method: 'GET' }).then((p) => {
        const fallbackImage = normalizeGoodsImageUrl(p.image) || '';
        const minSalePrice = p.price || 0;
        const maxLinePrice = p.originPrice || p.price || 0;
        const stockQty = p.stock || 0;
        return {
            spuId: String(p.id),
            title: p.title || '',
            intro: p.description || '',
            brand: p.brand || '',
            company: p.company || '',
            primaryImage: fallbackImage,
            images: fallbackImage ? [fallbackImage] : [],
            minSalePrice,
            maxSalePrice: minSalePrice,
            maxLinePrice,
            soldNum: p.soldNum || 0,
            isPutOnSale: p.status === 'ON' ? 1 : 0,
            spuStockQuantity: stockQty,
            available: stockQty > 0 ? 1 : 0,
            desc: [],
            limitInfo: [{ text: '' }],
            specList: [{ specId: 'default', title: '默认规格', specValueList: [{ specValueId: 'default', specValue: '默认' }] }],
            skuList: [
                {
                    skuId: `sku-${p.id}`,
                    price: minSalePrice,
                    skuImage: fallbackImage,
                    stockInfo: { stockQuantity: stockQty },
                    specInfo: [{ specId: 'default', specValueId: 'default' }],
                },
            ],
        };
    });
}
