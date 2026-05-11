import { requestJson } from '../../../../services/_utils/http';
import { config } from '../../../../config/runtime';

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
  return { ...m, msgType, displayUrl, voiceSec, voiceBarWidth };
}

export function enrichSupportMessages(list) {
  return (Array.isArray(list) ? list : []).map((m) => enrichSupportMessage(/** @type {Record<string, unknown>} */ (m)));
}

export const listMySupportMessages = () => requestJson('/api/support/messages', { method: 'GET' });
export const getMySupportPeerTyping = () => requestJson('/api/support/typing', { method: 'GET' });
export const setMySupportTyping = (typing) => requestJson('/api/support/typing', { method: 'POST', data: { typing: Boolean(typing) } });

export const createMySupportMessage = (payload) => {
  const body = typeof payload === 'string' ? { content: payload, msgType: 'text' } : payload;
  return requestJson('/api/support/messages', { method: 'POST', data: body });
};

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

