/**
 * 런타임 공통 설정(경량): areaData 대용량 데이터는 포함하지 않음
 *
 * 真机预览 / 线上：wx.request 仅允许 HTTPS，且请求主机须在
 * 微信公众平台 → 开发 → 开发管理 → 服务器域名 → request 合法域名 中配置（须备案域名，不能填裸 IP）。
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html
 *
 * 与本仓库 Caddy 块对应、须在后台登记的主机示例（无 https://）:
 *   hebibingtest.shop, 39-106-213-185.sslip.io, 39.106.213.185.nip.io
 * 运营核对清单: docs/kr/SERVER_SYNC_AND_PATHS.md §6
 *
 * 开发者工具：可勾选「不校验合法域名」时用 HTTP 直连 ECS:3000 调试（仅本地）。
 */

const USE_LOCAL_API = false;
const LOCAL_API_BASE = 'http://127.0.0.1:3000';

/**
 * null: 按平台规则。
 * true/false: 强制全体走 HTTPS / HTTP（仅排障）
 */
const CLOUD_USE_HTTPS_OVERRIDE = /** @type {boolean | null} */ (null);

/**
 * true: 开发者工具优先走 HTTPS（海外网络常连不上国内 ECS 公网 3000）。
 * false: 开发者工具走 CLOUD_HTTP_API_BASE（须关闭域名校验且本机能访问 3000）。
 */
const DEVTOOLS_USE_CLOUD_HTTPS = true;

/** 主 HTTPS API 根（须与 mp 后台 request 合法域名中的主机一致，无路径无端口） */
const CLOUD_HTTPS_API_BASE = 'https://hebibingtest.shop';

/** 覆盖主地址（排查时临时指向 sslip 等，须同期在 mp 后台登记该域名） */
const CLOUD_HTTPS_API_BASE_OVERRIDE = '';

/**
 * 真机备用 HTTPS 根（可选）。主域名在部分网络 RST 时，若已在后台登记 sslip 等可填此项。
 * 例：https://39-106-213-185.sslip.io
 */
const CLOUD_HTTPS_FALLBACK_BASE = '';

/** 直连后端 HTTP（仅开发者工具 + 关闭域名校验；真机预览不可用） */
const CLOUD_HTTP_API_BASE = 'http://39.106.213.185:3000';

/**
 * 运行环境 platform（devtools / ios / android …）
 * 优先 wx.getDeviceInfo，避免 apiBaseUrl getter 等高频路径反复触发 getSystemInfoSync 弃用警告。
 */
function getMiniProgramPlatform() {
    try {
        if (typeof wx !== 'undefined' && typeof wx.getDeviceInfo === 'function') {
            const d = wx.getDeviceInfo();
            if (d && typeof d.platform === 'string' && d.platform)
                return d.platform;
        }
    }
    catch (_) { /* ignore */ }
    try {
        if (typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function')
            return String(wx.getSystemInfoSync().platform || '');
    }
    catch (_) { /* ignore */ }
    return '';
}

function parseEcsPublicIpFromHttpBase() {
  const raw = String(CLOUD_HTTP_API_BASE || '');
  const m = raw.match(/^https?:\/\/([\d.]+)(?::\d+)?/);
  return m ? m[1] : '';
}

/** 由 ECS 公网 IP 推导 sslip HTTPS（须在 mp 登记 request 域名） */
function getAutoSslipHttpsBase() {
  const ip = parseEcsPublicIpFromHttpBase();
  if (!ip) return '';
  const octets = ip.split('.');
  if (octets.length !== 4) return '';
  return `https://${octets.join('-')}.sslip.io`.replace(/\/+$/, '');
}

/** 由同一 IP 推导 nip.io HTTPS（DNS·后台均须可用时再作为候选） */
function getAutoNipHttpsBase() {
  const ip = parseEcsPublicIpFromHttpBase();
  if (!ip) return '';
  return `https://${ip}.nip.io`.replace(/\/+$/, '');
}

/** 本会话探测成功的 API 根（真机仅允许 https://） */
let sessionApiBaseUrl = '';

export function getSessionApiBaseUrl() {
  return sessionApiBaseUrl;
}

export function setSessionApiBaseUrl(url) {
  const u = String(url || '').trim().replace(/\/+$/, '');
  if (!u) return;
  try {
    if (typeof wx !== 'undefined') {
      const p = getMiniProgramPlatform();
      if (p !== 'devtools' && !/^https:\/\//i.test(u)) return;
    }
  } catch (_) {
    if (!/^https:\/\//i.test(u)) return;
  }
  sessionApiBaseUrl = u;
}

export function getDevtoolsProbeBaseUrls() {
  const h = getCloudHttpsApiBase();
  const p = CLOUD_HTTP_API_BASE.replace(/\/+$/, '');
  return DEVTOOLS_USE_CLOUD_HTTPS ? [h, p] : [p, h];
}

/** 真机用于启动探测的 HTTPS 列表（主域名 + 手工备用 + 自动 sslip + 自动 nip） */
export function getPhoneHttpsProbeBases() {
  const primary = getCloudHttpsApiBase();
  const list = [primary];
  const fb = String(CLOUD_HTTPS_FALLBACK_BASE || '').trim().replace(/\/+$/, '');
  if (fb && fb !== primary && !list.includes(fb)) list.push(fb);
  const autoSslip = getAutoSslipHttpsBase();
  if (autoSslip && !list.includes(autoSslip)) list.push(autoSslip);
  const autoNip = getAutoNipHttpsBase();
  if (autoNip && !list.includes(autoNip)) list.push(autoNip);
  return list;
}

/** 开发者工具：HTTPS ↔ HTTP 直连 切换 */
export function getAlternateApiBaseForDevtools(currentBase) {
  if (CLOUD_USE_HTTPS_OVERRIDE !== null) return '';
  try {
    if (typeof wx === 'undefined') return '';
    if (getMiniProgramPlatform() !== 'devtools') return '';
  } catch (_) {
    return '';
  }
  const cur = String(currentBase || '').trim().replace(/\/+$/, '');
  const h = getCloudHttpsApiBase();
  const p = CLOUD_HTTP_API_BASE.replace(/\/+$/, '');
  if (cur === h) return p;
  if (cur === p) return h;
  return '';
}

/** API 根 URL 비교용（호스트 대소문자·기본 포트 정리）— indexOf 폴백 끊김 방지 */
function normalizeHttpsOrigin(u) {
  const s = String(u || '').trim().replace(/\/+$/, '');
  try {
    const x = new URL(s);
    const host = x.hostname.toLowerCase();
    const proto = x.protocol.toLowerCase();
    if (proto === 'https:' && (!x.port || x.port === '443')) return `https://${host}`;
    if (proto === 'http:' && (!x.port || x.port === '80')) return `http://${host}`;
    return `${proto}//${host}:${x.port}`;
  } catch (_) {
    return s.toLowerCase();
  }
}

const _wxProbeNet = Object.freeze({ enableHttp2: false, enableQuic: false });

function probeApiHealthOnce(baseUrl, timeoutMs) {
  const b = String(baseUrl || '').trim().replace(/\/+$/, '');
  return new Promise((resolve) => {
    if (!b || typeof wx === 'undefined' || typeof wx.request !== 'function') {
      resolve(false);
      return;
    }
    wx.request({
      ..._wxProbeNet,
      url: `${b}/api/health`,
      method: 'GET',
      timeout: timeoutMs,
      success(res) {
        const codeOk = res.statusCode >= 200 && res.statusCode < 300;
        const body = res.data;
        const jsonOk = body == null || typeof body !== 'object' || body.ok !== false;
        resolve(Boolean(codeOk && jsonOk));
      },
      fail: () => resolve(false),
    });
  });
}

let _phoneSessionEnsureInFlight = null;

/**
 * 真机且尚未 setSessionApiBaseUrl 时，按 getPhoneHttpsProbeBases 顺序探测 /api/health。
 * 缓解 App.onLaunch 异步探测与首屏 requestJson 竞态（官方社区常见「首包失败」场景）。
 */
export function ensurePhoneApiSessionBase(opts = {}) {
  if (getSessionApiBaseUrl()) return Promise.resolve(true);
  try {
    if (typeof wx === 'undefined') return Promise.resolve(true);
    if (getMiniProgramPlatform() === 'devtools') return Promise.resolve(true);
  } catch (_) {
    return Promise.resolve(true);
  }
  if (_phoneSessionEnsureInFlight) return _phoneSessionEnsureInFlight;
  const timeoutMs = typeof opts.timeoutMs === 'number' && opts.timeoutMs > 0 ? opts.timeoutMs : 10000;
  _phoneSessionEnsureInFlight = (async () => {
    try {
      const bases = getPhoneHttpsProbeBases();
      for (const base of bases) {
        if (await probeApiHealthOnce(base, timeoutMs)) {
          setSessionApiBaseUrl(base);
          return true;
        }
      }
      return false;
    } finally {
      _phoneSessionEnsureInFlight = null;
    }
  })();
  return _phoneSessionEnsureInFlight;
}

/** 真机：按 getPhoneHttpsProbeBases() 顺序链式切换下一个 HTTPS（不降级到 HTTP） */
export function getAlternatePhoneHttpsBase(currentBase) {
  if (CLOUD_USE_HTTPS_OVERRIDE !== null) return '';
  try {
    if (typeof wx === 'undefined') return '';
    if (getMiniProgramPlatform() === 'devtools') return '';
  } catch (_) {
    return '';
  }
  const cur = normalizeHttpsOrigin(currentBase);
  const chain = getPhoneHttpsProbeBases();
  const canon = chain.map(normalizeHttpsOrigin);
  const i = canon.indexOf(cur);
  if (i >= 0 && i < chain.length - 1) return chain[i + 1];
  return '';
}

function getCloudHttpsApiBase() {
  const o = String(CLOUD_HTTPS_API_BASE_OVERRIDE || '').trim();
  if (o) return o.replace(/\/+$/, '');
  return CLOUD_HTTPS_API_BASE.replace(/\/+$/, '');
}

function resolveCloudUseHttpsNip() {
  if (CLOUD_USE_HTTPS_OVERRIDE !== null) return CLOUD_USE_HTTPS_OVERRIDE;
  try {
    if (typeof wx !== 'undefined') {
      const platform = getMiniProgramPlatform();
      if (platform === 'devtools') return DEVTOOLS_USE_CLOUD_HTTPS;
    }
  } catch (_) {}
  return true;
}

export const config = {
  useMock: false,
  get apiBaseUrl() {
    if (USE_LOCAL_API) return LOCAL_API_BASE;
    if (sessionApiBaseUrl) {
      try {
        const p = getMiniProgramPlatform();
        if (p !== 'devtools' && !/^https:\/\//i.test(sessionApiBaseUrl)) {
          return getCloudHttpsApiBase();
        }
      } catch (_) {
        if (!/^https:\/\//i.test(sessionApiBaseUrl)) return getCloudHttpsApiBase();
      }
      return sessionApiBaseUrl;
    }
    return resolveCloudUseHttpsNip() ? getCloudHttpsApiBase() : CLOUD_HTTP_API_BASE;
  },
  cloudServerHttpOrigin: USE_LOCAL_API ? '' : CLOUD_HTTP_API_BASE.replace(/\/+$/, ''),
  customerServicePhone: '13331637172',
};

export const cdnBase = 'https://we-retail-static-1300977798.cos.ap-guangzhou.myqcloud.com/retail-mp';
