import updateManager from './common/updateManager';
import { getErrorMessage } from './services/_utils/errors';
import { config, setSessionApiBaseUrl, getDevtoolsProbeBaseUrls, getPhoneHttpsProbeBases } from './config/runtime';
import { wxRequestTransportOpts } from './services/_utils/wxRequestTransport';

/** @param {{ timeout?: number, attempts?: number, gapMs?: number }} opts */
function probeHealthReachable(baseUrl, opts = {}) {
    const b = String(baseUrl || '').replace(/\/+$/, '');
    const timeout = opts.timeout ?? 8000;
    const attempts = Math.max(1, opts.attempts ?? 1);
    const gapMs = opts.gapMs ?? 500;
    return new Promise((resolve) => {
        let n = 0;
        const once = () => {
            wx.request({
                ...wxRequestTransportOpts,
                url: `${b}/api/health`,
                method: 'GET',
                timeout,
                success(res) {
                    const codeOk = res.statusCode >= 200 && res.statusCode < 300;
                    const body = res.data;
                    const jsonOk = body == null || typeof body !== 'object' || body.ok !== false;
                    if (codeOk && jsonOk)
                        return resolve(true);
                    n += 1;
                    if (n < attempts)
                        setTimeout(once, gapMs);
                    else {
                        try {
                            console.warn('[probe bad status]', b, res.statusCode, res.data);
                        }
                        catch (_) {}
                        resolve(false);
                    }
                },
                fail(err) {
                    n += 1;
                    if (n < attempts)
                        setTimeout(once, gapMs);
                    else {
                        try {
                            console.warn('[probe fail]', b, err?.errMsg || err || '');
                        }
                        catch (_) {}
                        resolve(false);
                    }
                },
            });
        };
        once();
    });
}

App({
    globalData: {},
    onLaunch: function () {
        const logApiBase = () => {
            try {
                const sys = typeof wx !== 'undefined' && wx.getSystemInfoSync ? wx.getSystemInfoSync() : {};
                console.info('[apiBase]', config.apiBaseUrl, 'platform=', sys.platform || '');
            }
            catch (_) {}
        };
        try {
            const sys = wx.getSystemInfoSync?.() || {};
            if (sys.platform === 'devtools') {
                const bases = getDevtoolsProbeBaseUrls();
                (async () => {
                    for (const base of bases) {
                        if (await probeHealthReachable(base, { attempts: 2, timeout: 10000 })) {
                            setSessionApiBaseUrl(base);
                            console.info('[apiBase] devtools 探测可用', base);
                            logApiBase();
                            return;
                        }
                    }
                    console.warn('[apiBase] devtools HTTPS/HTTP 均失败：检查本机网络、ECS 安全组 3000/443、域名 mp 后台登记');
                    logApiBase();
                })();
                return;
            }
            /** 真机预览：仅 HTTPS，依次探测主域名与 CLOUD_HTTPS_FALLBACK_BASE（官方要求见 runtime.js 顶部注释） */
            const phoneBases = getPhoneHttpsProbeBases();
            (async () => {
                const probeOpts = { attempts: 3, timeout: 15000, gapMs: 600 };
                for (const base of phoneBases) {
                    if (await probeHealthReachable(base, probeOpts)) {
                        setSessionApiBaseUrl(base);
                        console.info('[apiBase] 真机探测可用', base);
                        logApiBase();
                        return;
                    }
                }
                console.warn(
                    '[apiBase] 真机 HTTPS 均失败：①开发管理→服务器域名→request合法域名须含 hebibingtest.shop 与 sslip 主机(若用) ②同一小程序AppID ③清除缓存重编译预览 ④仍失败多为 TLS/RST 见 ECS/Caddy',
                );
                logApiBase();
            })();
            return;
        }
        catch (_) {}
        logApiBase();
        // 첫 진입은 비로그인 상태 유지: 로그인은 사용자 명시 동작(마이페이지 버튼)에서만 진행
    },
    onShow: function () {
        updateManager();
    },
    onError(err) {
        try {
            // 실기기에서 네트워크/런타임 오류 원문을 빠르게 확인하기 위한 최소 표시
            const msg = typeof err === 'string' ? err : getErrorMessage(err);
            console.error('[app.onError]', err);
            wx.showToast({ title: String(msg).slice(0, 60), icon: 'none', duration: 3000 });
        }
        catch (_) {
            // ignore
        }
    },
    onUnhandledRejection(res) {
        try {
            const reason = res?.reason;
            const msg = getErrorMessage(reason);
            const url = reason?.raw?.url || reason?.raw?.request?.url || '';
            const errMsg = reason?.raw?.errMsg || reason?.raw?.message || '';
            console.error('[app.onUnhandledRejection]', res);
            wx.showToast({
                title: String(url ? `[NET] ${errMsg || msg}` : msg).slice(0, 60),
                icon: 'none',
                duration: 3000,
            });
        }
        catch (_) {
            // ignore
        }
    },
});
