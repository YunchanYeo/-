import updateManager from './common/updateManager';
import { getErrorMessage } from './services/_utils/errors';
import { config, setSessionApiBaseUrl, getDevtoolsProbeBaseUrls, getPhoneHttpsProbeBases, getSessionApiBaseUrl, ensurePhoneApiSessionBase, getMiniProgramPlatform } from './config/runtime';
import { wxRequestTransportOpts } from './services/_utils/wxRequestTransport';

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

let _netReprobeBound = false;
/** 真机：断网恢复后再次探测 API 根 */
function bindNetworkApiReprobe() {
    if (_netReprobeBound) return;
    _netReprobeBound = true;
    if (typeof wx.onNetworkStatusChange !== 'function') return;
    wx.onNetworkStatusChange((res) => {
        try {
            if (!res || !res.isConnected) return;
            if (getMiniProgramPlatform() === 'devtools') return;
            const phoneBases = getPhoneHttpsProbeBases();
            (async () => {
                const probeOpts = { attempts: 2, timeout: 12000, gapMs: 500 };
                for (const base of phoneBases) {
                    if (await probeHealthReachable(base, probeOpts)) {
                        setSessionApiBaseUrl(base);
                        console.info('[apiBase] 网络恢复后重探测可用', base);
                        return;
                    }
                }
            })();
        }
        catch (_) { /* ignore */ }
    });
}

let _lastOnShowPhoneEnsureMs = 0;

App({
    globalData: {},
    onLaunch: function () {
        bindNetworkApiReprobe();
        const logApiBase = () => {
            try {
                console.info('[apiBase]', config.apiBaseUrl, 'platform=', getMiniProgramPlatform() || '');
            }
            catch (_) {}
        };
        try {
            if (getMiniProgramPlatform() === 'devtools') {
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
                /** -101 ERR_CONNECTION_RESET 대비: 동일 URL 다회 + 긴 간격 */
                const probeOpts = { attempts: 6, timeout: 20000, gapMs: 1200 };
                for (const base of phoneBases) {
                    if (await probeHealthReachable(base, probeOpts)) {
                        setSessionApiBaseUrl(base);
                        console.info('[apiBase] 真机探测可用', base);
                        logApiBase();
                        return;
                    }
                }
                console.warn(
                    '[apiBase] 真机 HTTPS 均失败：若日志为 -101/ERR_CONNECTION_RESET 多为跨境链路/运营商 RST（非合法域名）；换 4G/其他 Wi‑Fi、ECS 安全组 443、Caddy 443 监听 확인。另：①mp 域名含当前探测主机 ②AppID 一致 ③清缓存重编译',
                );
                logApiBase();
                setTimeout(() => {
                    if (getSessionApiBaseUrl()) return;
                    (async () => {
                        const retryOpts = { attempts: 5, timeout: 20000, gapMs: 1500 };
                        for (const base of phoneBases) {
                            if (await probeHealthReachable(base, retryOpts)) {
                                setSessionApiBaseUrl(base);
                                console.info('[apiBase] 真机延迟二次探测可用', base);
                                logApiBase();
                                return;
                            }
                        }
                    })();
                }, 4500);
            })();
            return;
        }
        catch (_) {}
        logApiBase();
        // 첫 진입은 비로그인 상태 유지: 로그인은 사용자 명시 동작(마이페이지 버튼)에서만 진행
    },
    onShow: function () {
        updateManager();
        try {
            if (getMiniProgramPlatform() === 'devtools') return;
            if (getSessionApiBaseUrl()) return;
            const now = Date.now();
            if (now - _lastOnShowPhoneEnsureMs < 5000) return;
            _lastOnShowPhoneEnsureMs = now;
            ensurePhoneApiSessionBase({ timeoutMs: 9000 })
                .then((ok) => {
                    if (ok)
                        console.info('[apiBase] onShow 补探测已写入 session');
                })
                .catch(() => {});
        }
        catch (_) { /* ignore */ }
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
