import { config, getAlternateApiBaseForDevtools, getAlternatePhoneHttpsBase, setSessionApiBaseUrl, ensurePhoneApiSessionBase } from '../../config/runtime';
import { createAppError, ErrorCodes } from './errors';
import { getToken } from '../auth/session';
import { wxRequestTransportOpts } from './wxRequestTransport';
function joinUrl(baseUrl, path) {
    const base = baseUrl.replace(/\/+$/, '');
    const p = path.startsWith('/') ? path : `/${path}`;
    return `${base}${p}`;
}
function getStatusHint(statusCode) {
    const map = {
        400: '请求参数错误（请检查 body/query）。',
        401: '需要登录后再操作。',
        403: '没有权限执行该操作。',
        404: '未找到对应的 API 路径。',
        405: '请求方法不被允许。',
        409: '数据冲突，请刷新后重试。',
        422: '请求数据校验失败。',
        429: '请求过于频繁，请稍后再试。',
        500: '服务器内部错误。',
        502: '网关错误。',
        503: '服务暂时不可用。',
        504: '服务器响应超时。',
    };
    return map[statusCode] || 'HTTP 请求失败。';
}
const MAX_NET_ALT_HOPS = 6;

export function requestJson(path, options = {}) {
    const { method = 'GET', data, header = {}, timeoutMs = 15000 } = options;
    const token = getToken();
    const run = (base, hop) =>
        new Promise((resolve, reject) => {
            const url = joinUrl(base, path);
            wx.request({
                ...wxRequestTransportOpts,
                url,
                method,
                data,
                header: {
                    'content-type': 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    ...header,
                },
                timeout: timeoutMs,
                success(res) {
                    const { statusCode } = res;
                    if (statusCode === 401) {
                        return reject(createAppError(ErrorCodes.HTTP_STATUS_ERROR, '[HTTP 401] 请先完成微信授权登录后再操作。', {
                            statusCode,
                            response: res.data,
                            url,
                            method,
                        }));
                    }
                    if (typeof statusCode === 'number' && (statusCode < 200 || statusCode >= 300)) {
                        const hint = getStatusHint(statusCode);
                        return reject(createAppError(ErrorCodes.HTTP_STATUS_ERROR, `[HTTP ${statusCode}] ${hint}`, { statusCode, response: res.data, url, method }));
                    }
                    const body = res.data;
                    if (!body || typeof body !== 'object') {
                        return reject(createAppError(ErrorCodes.BAD_RESPONSE, '服务器返回的不是合法 JSON 对象。', res));
                    }
                    if (!body.ok) {
                        return reject(createAppError(ErrorCodes.BACKEND_ERROR, body.message || '服务器返回了错误。', body));
                    }
                    try {
                        const sys = typeof wx !== 'undefined' && wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
                        const isDevtools = String(sys.platform || '') === 'devtools';
                        const b = String(base || '').trim().replace(/\/+$/, '');
                        if (!isDevtools && hop === 0 && /^https:\/\//i.test(b))
                            setSessionApiBaseUrl(b);
                        else if (hop > 0)
                            setSessionApiBaseUrl(b);
                    }
                    catch (_) {
                        if (hop > 0)
                            setSessionApiBaseUrl(String(base).replace(/\/+$/, ''));
                    }
                    resolve(body.data);
                },
                fail(err) {
                    let msg = err?.errMsg || '网络错误';
                    if (String(msg).toLowerCase().includes('timeout')) {
                        return reject(createAppError(ErrorCodes.TIMEOUT, `请求超时：${url}`, err));
                    }
                    const alt =
                        hop < MAX_NET_ALT_HOPS
                            ? getAlternateApiBaseForDevtools(base) || getAlternatePhoneHttpsBase(base)
                            : '';
                    if (alt) {
                        run(String(alt).replace(/\/+$/, ''), hop + 1).then(resolve).catch(reject);
                        return;
                    }
                    const m = String(msg);
                    if (/合法域名|domain|not in domain list|ssl|certificate|TLS|CONNECTION_RESET|connection reset/i.test(m)) {
                        msg += `（真机须 mp 后台登记 request/upload 域名；开发者工具「不校验」对真机无效；仍失败可换 Wi‑Fi/4G、清小程序缓存、重编译预览；详见 runtime.js 顶部注释）`;
                    }
                    reject(createAppError(ErrorCodes.NETWORK_ERROR, msg, { ...err, url, method }));
                },
            });
        });
    return ensurePhoneApiSessionBase({ timeoutMs: Math.min(12000, timeoutMs) })
        .catch(() => {})
        .then(() => run(config.apiBaseUrl, 0));
}
