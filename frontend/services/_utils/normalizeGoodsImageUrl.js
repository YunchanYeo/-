import { config } from '../../config/index';

function ensureHttps(s) {
    const out = String(s || '').trim();
    if (out.toLowerCase().startsWith('http://'))
        return `https://${out.slice('http://'.length)}`;
    return out;
}

function rewriteAbsoluteToApiBase(s) {
    const base = config.apiBaseUrl.replace(/\/+$/, '');
    let out = ensureHttps(s).replace(/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?/i, base);
    const legacy = config.cloudServerHttpOrigin;
    if (legacy && /^https?:\/\//i.test(out)) {
        const prefix = legacy.replace(/\/+$/, '');
        if (out.startsWith(prefix))
            out = base + out.slice(prefix.length);
    }
    return out;
}

/**
 * 订单/购物车商品图 URL 的唯一归一入口（别处勿再复制一份逻辑，以免与详情/结算页不一致）。
 *
 * — 后端 `localhost`/`127`、`http://公网IP:3000`、`/uploads/...` → 현재 `apiBaseUrl`(폰용 HTTPS 포함)
 *
 * `orderConfirm`・`orderDetail`・`orderList`・`cart`・订单详情页的 `thumb` 均应按需调用本函数。
 *
 * @param {string} [image]
 * @returns {string}
 */
export function normalizeGoodsImageUrl(image) {
    if (!image) return '';
    const s = ensureHttps(image);
    const base = config.apiBaseUrl.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(s)) {
        return rewriteAbsoluteToApiBase(s);
    }
    if (s.startsWith('/')) return `${base}${s}`;
    return `${base}/${s.replace(/^\/+/, '')}`;
}
