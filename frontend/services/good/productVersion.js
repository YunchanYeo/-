const PRODUCT_DATA_VERSION_KEY = 'product.data.version';
export function getProductDataVersion() {
    return Number(wx.getStorageSync(PRODUCT_DATA_VERSION_KEY) || 0);
}
export function bumpProductDataVersion() {
    const nextVersion = Date.now();
    wx.setStorageSync(PRODUCT_DATA_VERSION_KEY, nextVersion);
    return nextVersion;
}
