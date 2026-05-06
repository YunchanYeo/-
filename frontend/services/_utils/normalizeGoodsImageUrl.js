import { config } from '../../config/index';

/**
 * 订单/购物车商品图 URL 的唯一归一入口（别处勿再复制一份逻辑，以免与详情/结算页不一致）。
 *
 * — 后端 `localhost`/`127`、`/uploads/...` → 拼接 `config.apiBaseUrl`
 *
 * `orderConfirm`・`orderDetail`・`orderList`・`cart`・订单详情页的 `thumb` 均应按需调用本函数。
 *
 * @param {string} [image]
 * @returns {string}
 */
export function normalizeGoodsImageUrl(image) {
    if (!image) return '';
    const s = String(image).trim();
    const base = config.apiBaseUrl.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(s)) {
        return s.replace(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i, base);
    }
    if (s.startsWith('/')) return `${base}${s}`;
    return `${base}/${s.replace(/^\/+/, '')}`;
}
