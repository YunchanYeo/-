import { config } from '../../config/runtime';
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
function isConnectionResetErrMsg(msg) {
    return /CONNECTION_RESET|connection reset|ERR_CONNECTION_RESET|-101/i.test(String(msg));
}
export function requestJson(path, options = {}) {
    const { method = 'GET', data, header = {}, timeoutMs = 15000 } = options;
    const url = joinUrl(config.apiBaseUrl, path);
    return new Promise((resolve, reject) => {
        const token = getToken();
        const notifyFail = (err, msg) => {
            try {
                console.error('[wx.request.fail]', method, url, err);
                wx.showToast({
                    title: String(`[NET] ${msg}`).slice(0, 60),
                    icon: 'none',
                    duration: 3000,
                });
            }
            catch (_) {
                // ignore
            }
        };
        const run = (isRetry) => {
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
                    resolve(body.data);
                },
                fail(err) {
                    let msg = err?.errMsg || '网络错误';
                    if (String(msg).toLowerCase().includes('timeout')) {
                        notifyFail(err, msg);
                        return reject(createAppError(ErrorCodes.TIMEOUT, `请求超时：${url}`, err));
                    }
                    if (method === 'GET' && isConnectionResetErrMsg(msg) && !isRetry) {
                        setTimeout(() => run(true), 400);
                        return;
                    }
                    const m = String(msg);
                    if (/合法域名|domain|not in domain list|ssl|certificate|TLS|CONNECTION_RESET|connection reset/i.test(m)) {
                        msg += `（请核对：1）mp.weixin.qq.com 服务器域名是否含请求主机；2）project.config.json 的 appid 是否与该小程序一致；3）重新编译后再预览；4）仍 RST 可试换自有域名 HTTPS）`;
                    }
                    notifyFail(err, msg);
                    reject(createAppError(ErrorCodes.NETWORK_ERROR, msg, { ...err, url, method }));
                },
            });
        };
        run(false);
    });
}
