/**
 * 런타임 공통 설정(경량): areaData 대용량 데이터는 포함하지 않음
 */
const USE_LOCAL_API = false;
const LOCAL_API_BASE = 'http://127.0.0.1:3000';
const CLOUD_USE_HTTPS_OVERRIDE = /** @type {boolean | null} */ (true);
const CLOUD_HTTPS_API_BASE = 'https://hebibingtest.shop';
const CLOUD_HTTPS_API_BASE_OVERRIDE = '';
const CLOUD_HTTP_API_BASE = 'http://39.106.213.185:3000';

function getCloudHttpsApiBase() {
  const o = String(CLOUD_HTTPS_API_BASE_OVERRIDE || '').trim();
  if (o) return o.replace(/\/+$/, '');
  return CLOUD_HTTPS_API_BASE.replace(/\/+$/, '');
}

function resolveCloudUseHttpsNip() {
  if (CLOUD_USE_HTTPS_OVERRIDE !== null) return CLOUD_USE_HTTPS_OVERRIDE;
  try {
    if (typeof wx !== 'undefined' && wx.getSystemInfoSync) {
      const platform = wx.getSystemInfoSync().platform;
      if (platform === 'devtools') return false;
    }
  } catch (_) {
    // wx 초기화 전에는 폰 기준으로 HTTPS
  }
  return true;
}

export const config = {
  useMock: false,
  get apiBaseUrl() {
    if (USE_LOCAL_API) return LOCAL_API_BASE;
    return resolveCloudUseHttpsNip() ? getCloudHttpsApiBase() : CLOUD_HTTP_API_BASE;
  },
  cloudServerHttpOrigin: USE_LOCAL_API ? '' : CLOUD_HTTP_API_BASE.replace(/\/+$/, ''),
  customerServicePhone: '13331637172',
};

export const cdnBase = 'https://we-retail-static-1300977798.cos.ap-guangzhou.myqcloud.com/retail-mp';

