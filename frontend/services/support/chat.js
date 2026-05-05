import { requestJson } from '../_utils/http';
import { config } from '../../config/index';
import { getAdminToken } from '../admin/session';

/**
 * @param {string} path
 * @param {{ method?: string, data?: unknown, timeout?: number }} [options]
 * @returns {Promise<unknown>}
 */
function requestAdminJson(path, { method = 'GET', data, timeout = 10000 } = {}) {
  const token = getAdminToken();
  return new Promise((resolve, reject) => {
    wx.request({
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

/**
 * 将后端返回的 localhost 媒体 URL 替换为当前小程序配置的 API 主机，便于真机调试。
 * @param {string} url
 * @returns {string}
 */
export function normalizeChatMediaUrl(url) {
  if (!url) return '';
  const base = config.apiBaseUrl.replace(/\/+$/, '');
  try {
    const u = new URL(url);
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
      return `${base}${u.pathname}${u.search}`;
    }
  } catch (_) {}
  return url;
}

/**
 * @param {Record<string, unknown>} m
 * @returns {Record<string, unknown>}
 */
export function enrichSupportMessage(m) {
  const msgType = /** @type {'text'|'image'|'voice'} */ (m.msgType || 'text');
  const displayUrl =
    msgType === 'image' || msgType === 'voice' ? normalizeChatMediaUrl(String(m.content || '')) : '';
  let voiceSec = 0;
  if (msgType === 'voice') {
    if (m.meta && typeof /** @type {{ durationMs?: number }} */ (m.meta).durationMs === 'number') {
      voiceSec = Math.max(1, Math.round(/** @type {{ durationMs?: number }} */ (m.meta).durationMs / 1000));
    } else {
      voiceSec = 1;
    }
  }
  return { ...m, msgType, displayUrl, voiceSec };
}

/**
 * @param {unknown[]} list
 * @returns {Record<string, unknown>[]}
 */
export function enrichSupportMessages(list) {
  return (Array.isArray(list) ? list : []).map((m) => enrichSupportMessage(/** @type {Record<string, unknown>} */ (m)));
}

export const listMySupportMessages = () => requestJson('/api/support/messages', { method: 'GET' });

/**
 * @param {string | { msgType?: string, content: string, meta?: { durationMs?: number } }} payload
 */
export const createMySupportMessage = (payload) => {
  const body = typeof payload === 'string' ? { content: payload, msgType: 'text' } : payload;
  return requestJson('/api/support/messages', { method: 'POST', data: body });
};

/**
 * @param {{ kind: 'image'|'voice', filePath: string, mimeType?: string, fileName?: string }} opts
 * @returns {Promise<string>} 上传后的媒体 URL
 */
export function uploadSupportMedia(opts) {
  const { kind, filePath, mimeType = kind === 'image' ? 'image/jpeg' : 'audio/mpeg', fileName = 'file' } = opts;
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (r) => {
        requestJson('/api/support/upload-media', {
          method: 'POST',
          data: { kind, mimeType, fileName, base64Data: r.data },
          timeoutMs: 60000,
        })
          .then((data) => resolve(/** @type {{ url: string }} */ (data).url))
          .catch(reject);
      },
      fail: reject,
    });
  });
}

export const listAdminSupportConversations = () => requestAdminJson('/api/admin/support/conversations', { method: 'GET' });
export const listAdminSupportMessagesByUser = (userId) => requestAdminJson(`/api/admin/support/messages/${userId}`, { method: 'GET' });

/**
 * @param {string} userId
 * @param {string | { msgType?: string, content: string, meta?: { durationMs?: number } }} payload
 */
export const createAdminSupportReply = (userId, payload) => {
  const body = typeof payload === 'string' ? { content: payload, msgType: 'text' } : payload;
  return requestAdminJson(`/api/admin/support/messages/${userId}`, { method: 'POST', data: body });
};

/**
 * @param {{ kind: 'image'|'voice', filePath: string, mimeType?: string, fileName?: string }} opts
 * @returns {Promise<string>}
 */
export function uploadAdminSupportMedia(opts) {
  const { kind, filePath, mimeType = kind === 'image' ? 'image/jpeg' : 'audio/mpeg', fileName = 'file' } = opts;
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
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
  });
}
