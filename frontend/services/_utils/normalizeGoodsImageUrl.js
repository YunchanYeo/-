import { config } from '../../config/runtime';

function ensureHttps(s) {
    const out = String(s || '').trim();
    if (out.toLowerCase().startsWith('http://'))
        return `https://${out.slice('http://'.length)}`;
    return out;
}

/** www·大小写 무시 비교용 */
function normalizeHostname(h) {
    return String(h || '').toLowerCase().replace(/^www\./, '');
}

/** 구 클라우드 호스트（config 미동기화·옛 빌드에도 DB URL 치환되도록 내장） */
const FALLBACK_LEGACY_HOSTNAMES = /** @type {string[]} */ ([
    'hebibingtest.shop',
]);

/**
 * DB·客服消息里残留的「旧 HTTPS 部署域名」完整 URL → 当前 `apiBaseUrl` + 同路径/query（含 OSS 图片处理 query）
 * @param {string} [raw]
 * @returns {string}
 */
export function rewriteLegacyDeploymentUrl(raw) {
    const trimmed = String(raw || '').trim();
    /** 문자열에 구 업로드 호스트가 남은 경우（URL 파서 실패·옛 캐시 대비） */
    if (/hebibingtest\.shop/i.test(trimmed)) {
        const idxUploads = trimmed.indexOf('/uploads/');
        if (idxUploads >= 0) {
            const base = config.apiBaseUrl.replace(/\/+$/, '');
            return `${base}${trimmed.slice(idxUploads)}`;
        }
        const idxApi = trimmed.indexOf('/api/');
        if (idxApi >= 0) {
            const base = config.apiBaseUrl.replace(/\/+$/, '');
            return `${base}${trimmed.slice(idxApi)}`;
        }
    }
    if (!trimmed || !/^https?:\/\//i.test(trimmed))
        return trimmed;
    let u;
    try {
        u = new URL(ensureHttps(trimmed));
    }
    catch (_) {
        return trimmed;
    }
    const base = config.apiBaseUrl.replace(/\/+$/, '');
    const legacyHosts = new Set(FALLBACK_LEGACY_HOSTNAMES.map(normalizeHostname));
    const origins = /** @type {string[]} */ (config.legacyApiOrigins || []);
    for (const leg of origins) {
        const L = String(leg || '').trim().replace(/\/+$/, '');
        if (!L)
            continue;
        try {
            const lu = new URL(L.startsWith('http') ? L : `https://${L}`);
            legacyHosts.add(normalizeHostname(lu.hostname));
        }
        catch (_) { /* ignore */ }
    }
    if (legacyHosts.has(normalizeHostname(u.hostname)))
        return `${base}${u.pathname}${u.search}`;
    return trimmed;
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
    const s = rewriteLegacyDeploymentUrl(ensureHttps(image));
    const base = config.apiBaseUrl.replace(/\/+$/, '');
    if (/^https?:\/\//i.test(s)) {
        return rewriteAbsoluteToApiBase(s);
    }
    if (s.startsWith('/')) return `${base}${s}`;
    return `${base}/${s.replace(/^\/+/, '')}`;
}
