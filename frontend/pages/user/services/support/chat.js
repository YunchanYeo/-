import { requestJson } from '../../../../services/_utils/http';
import { config, ensurePhoneApiSessionBase } from '../../../../config/runtime';
import { getToken } from '../../../../services/auth/session';
import { wxRequestTransportOpts } from '../../../../services/_utils/wxRequestTransport';
import { resolveLocalUploadPath } from '../../../../services/_utils/resolveLocalUploadPath';

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

function joinApiUrl(path) {
  const base = config.apiBaseUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * 客服图片/语音上传。wx.uploadFile 의 filePath 는 **로컬 경로만**(공식)；`http://tmp/...` 는 resolveLocalUploadPath 로 변환 후 multipart.
 * 本地路径：uploadFile 실패 시 JSON+base64 폴백.
 */
export function uploadSupportMedia(opts) {
  const { kind, filePath, mimeType = kind === 'image' ? 'image/jpeg' : 'audio/mpeg', fileName = 'file' } = opts;
  const fp = String(filePath || '').trim();

  return ensurePhoneApiSessionBase({ timeoutMs: 12000 })
    .catch(() => {})
    .then(
      () =>
        new Promise((resolve, reject) => {
          if (!fp) {
            reject(new Error('empty filePath'));
            return;
          }

          const readBase64Upload = (localFp) => {
            wx.getFileSystemManager().readFile({
              filePath: localFp,
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
          };

          const runMultipart = (localFp) => {
            const token = getToken();
            const canBase64Fallback = !/^https?:\/\//i.test(localFp);
            wx.uploadFile({
              ...wxRequestTransportOpts,
              url: joinApiUrl('/api/support/upload-media'),
              filePath: localFp,
              name: 'file',
              formData: {
                kind: String(kind),
                mimeType: String(mimeType),
                fileName: String(fileName),
              },
              header: token ? { Authorization: `Bearer ${token}` } : {},
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
                if (canBase64Fallback) {
                  readBase64Upload(localFp);
                  return;
                }
                const hint = body && typeof body.message === 'string' ? body.message : `HTTP ${sc}`;
                reject(new Error(String(hint || 'uploadFile failed')));
              },
              fail: (err) => {
                if (canBase64Fallback) readBase64Upload(localFp);
                else reject(new Error(err?.errMsg || 'uploadFile failed'));
              },
            });
          };

          resolveLocalUploadPath(fp)
            .then(runMultipart)
            .catch(reject);
        }),
    );
}
