import { config } from '../../../../config/runtime';
import { wxRequestTransportOpts } from '../../../../services/_utils/wxRequestTransport';
import { requestJson } from '../../../../services/_utils/http';
import { getAdminToken } from '../session';

function requestAdminJson(path, { method = 'GET', data, timeout = 10000 } = {}) {
  const token = getAdminToken();
  return new Promise((resolve, reject) => {
    wx.request({
      ...wxRequestTransportOpts,
      url: `${config.apiBaseUrl}${path}`,
      method,
      data,
      timeout,
      header: {
        'content-type': 'application/json',
        ...(token ? { 'x-admin-token': token } : {}),
      },
      success(res) {
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(new Error(res.data?.message || `HTTP ${res.statusCode}`));
        if (!res.data?.ok) return reject(new Error(res.data?.message || 'Admin API failed'));
        return resolve(res.data.data);
      },
      fail(err) {
        reject(err);
      },
    });
  });
}

export function normalizeChatMediaUrl(url) {
  if (!url) return '';
  const s = String(url).trim();
  const base = config.apiBaseUrl.replace(/\/+$/, '');
  if (s.startsWith('/')) return `${base}${s}`;
  try {
    const u = new URL(s);
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
      return `${base}${u.pathname}${u.search}`;
    }
    const legacy = config.cloudServerHttpOrigin;
    if (legacy) {
      const lu = new URL(legacy.startsWith('http') ? legacy : `http://${legacy}`);
      const p = lu.port || (lu.protocol === 'https:' ? '443' : '80');
      const up = u.port || (u.protocol === 'https:' ? '443' : '80');
      if (u.hostname === lu.hostname && String(up) === String(p)) {
        return `${base}${u.pathname}${u.search}`;
      }
    }
  } catch (_) {
    if (!/^https?:\/\//i.test(s)) return `${base}/${s.replace(/^\/+/, '')}`;
  }
  return s;
}

export function enrichSupportMessage(m) {
  const msgType = /** @type {'text'|'image'|'voice'} */ (m.msgType || 'text');
  const displayUrl = msgType === 'image' || msgType === 'voice' ? normalizeChatMediaUrl(String(m.content || '')) : '';
  const orderNo = m.meta && typeof /** @type {{ orderNo?: unknown }} */ (m.meta).orderNo === 'string'
    ? String(/** @type {{ orderNo?: string }} */ (m.meta).orderNo || '').trim()
    : '';
  let voiceSec = 0;
  let voiceBarWidth = 0;
  if (msgType === 'voice') {
    if (m.meta && typeof /** @type {{ durationMs?: number }} */ (m.meta).durationMs === 'number') {
      voiceSec = Math.max(1, Math.round(/** @type {{ durationMs?: number }} */ (m.meta).durationMs / 1000));
    } else {
      voiceSec = 1;
    }
    voiceBarWidth = Math.min(560, Math.max(148, 120 + voiceSec * 32));
  }
  return { ...m, msgType, displayUrl, voiceSec, voiceBarWidth, orderNo };
}

export function enrichSupportMessages(list) {
  return (Array.isArray(list) ? list : []).map((m) => enrichSupportMessage(/** @type {Record<string, unknown>} */ (m)));
}

export const listAdminSupportConversations = () => requestAdminJson('/api/admin/support/conversations', { method: 'GET' });
export const listAdminSupportMessagesByUser = (userId) => requestAdminJson(`/api/admin/support/messages/${userId}`, { method: 'GET' });
export const getAdminSupportPeerTyping = (userId) => requestAdminJson(`/api/admin/support/typing/${userId}`, { method: 'GET' });
export const setAdminSupportTyping = (userId, typing) =>
  requestAdminJson(`/api/admin/support/typing/${userId}`, { method: 'POST', data: { typing: Boolean(typing) } });

export const createAdminSupportReply = (userId, payload) => {
  const body = typeof payload === 'string' ? { content: payload, msgType: 'text' } : payload;
  return requestAdminJson(`/api/admin/support/messages/${userId}`, { method: 'POST', data: body });
};

export function uploadAdminSupportMedia(opts) {
  const { kind, filePath, mimeType = kind === 'image' ? 'image/jpeg' : 'audio/mpeg', fileName = 'file' } = opts;
  const fp = String(filePath || '').trim();
  const isRemoteHttp = /^https?:\/\//i.test(fp);

  return new Promise((resolve, reject) => {
    const readBase64Upload = () => {
      wx.getFileSystemManager().readFile({
        filePath: fp,
        encoding: 'base64',
        success: (r) => {
          requestAdminJson('/api/admin/support/upload-media', {
            method: 'POST',
            data: { kind, mimeType, fileName, base64Data: r.data },
            timeout: 60000,
          })
            .then((data) => resolve(/** @type {{ url: string }} */ (data).url))
            .catch(reject);
        },
        fail: reject,
      });
    };

    if (!fp) {
      reject(new Error('empty filePath'));
      return;
    }

    const token = getAdminToken();
    wx.uploadFile({
      ...wxRequestTransportOpts,
      url: `${config.apiBaseUrl.replace(/\/+$/, '')}/api/admin/support/upload-media`,
      filePath: fp,
      name: 'file',
      formData: { kind, mimeType, fileName },
      header: token ? { 'x-admin-token': token } : {},
      timeout: 60000,
      success: (res) => {
        const sc = res.statusCode;
        const badStatus = typeof sc === 'number' && (sc < 200 || sc >= 300);
        let body = null;
        try {
          body = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
        } catch (_) {
          body = null;
        }
        const url = body && body.ok && body.data && typeof body.data.url === 'string' ? body.data.url : '';
        if (!badStatus && url) {
          resolve(url);
          return;
        }
        if (isRemoteHttp) {
          const hint = body && typeof body.message === 'string' ? body.message : `HTTP ${sc}`;
          reject(new Error(String(hint || 'uploadFile failed')));
          return;
        }
        readBase64Upload();
      },
      fail: (err) => {
        if (isRemoteHttp) {
          reject(new Error(err?.errMsg || 'uploadFile failed'));
          return;
        }
        readBase64Upload();
      },
    });
  });
}

// user endpoints are not used in admin page, but keep requestJson import referenced in pack to avoid tree-shake oddities
export const _noop = () => requestJson('/api/health', { method: 'GET' });

