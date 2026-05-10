import { config } from '../../config/index';

/**
 * 관리자 페이지 미리보기·<image src> — 위챗은 반드시 https 절대 URL 필요
 * @param {string} [url] DB 또는 API 가 준 경로/URL
 * @returns {string}
 */
export function resolveAdminImageForDisplay(url) {
    const s = String(url || '').trim();
    if (!s)
        return '';
    if (/^https?:\/\//i.test(s)) {
        if (s.toLowerCase().startsWith('http://'))
            return `https://${s.slice('http://'.length)}`;
        return s;
    }
    const base = config.apiBaseUrl.replace(/\/+$/, '');
    return `${base}${s.startsWith('/') ? s : `/${s}`}`;
}

/**
 * 저장 시 products.image — 같은 API 호스트의 절대 URL 이면 경로만 남김(미니·관리 공통)
 * @param {string} [displayOrStored]
 * @returns {string}
 */
export function toStoredProductImagePath(displayOrStored) {
    const s = String(displayOrStored || '').trim();
    if (!s)
        return '';
    const base = config.apiBaseUrl.replace(/\/+$/, '');
    if (s.startsWith(base))
        return s.slice(base.length) || '';
    try {
        const u = new URL(s);
        const b = new URL(base);
        if (u.host === b.host && u.protocol === b.protocol)
            return `${u.pathname}${u.search}`;
    }
    catch (_) {
        /* */
    }
    return s;
}
