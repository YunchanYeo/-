import type { Db } from '../types';

const MAX_BYTES = 2 * 1024 * 1024;

/** 小程序侧 wx.getUserProfile 等返回的头像域名 — 客户端 download 合法域名 없이는 <image> 加载失败하므로 서버에서转存 */
export function isLikelyWeChatAvatarCdnUrl(raw: string): boolean {
  const u = String(raw || '').trim();
  if (!u.startsWith('http')) return false;
  try {
    const h = new URL(u).hostname.toLowerCase();
    if (h.endsWith('.qlogo.cn') || h === 'qlogo.cn') return true;
    if (h.includes('qpic.cn')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * 将微信 CDN 头像拉取后写入 user_avatar_media，并返回可公开访问的相对路径；
 * 非微信 CDN 或拉取失败时返回原字符串；空字符串则清空 BLOB。
 */
export async function normalizeUserAvatarForStorage(db: Db, userId: number, raw: string): Promise<string> {
  const u = String(raw ?? '').trim();
  if (!u) {
    try {
      db.prepare(`DELETE FROM user_avatar_media WHERE userId = ?`).run(userId);
    } catch {
      /* ignore */
    }
    return '';
  }
  if (u.startsWith('/api/media/user-avatar/')) return u;
  if (!isLikelyWeChatAvatarCdnUrl(u)) return u;

  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 12_000);
    const res = await fetch(u, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'WeChatShopBackend/1.0' },
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn('[avatar-ingest] fetch failed', userId, res.status, u.slice(0, 80));
      return u;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_BYTES) {
      console.warn('[avatar-ingest] size skip', userId, buf.length);
      return u;
    }
    const rawMime = res.headers.get('content-type') || 'image/jpeg';
    let mime = (rawMime.split(';')[0] || 'image/jpeg').trim().toLowerCase();
    if (!mime.startsWith('image/')) mime = 'image/jpeg';

    db.prepare(`REPLACE INTO user_avatar_media (userId, mimeType, data, updatedAt) VALUES (?, ?, ?, datetime('now'))`).run(
      userId,
      mime,
      buf,
    );

    return `/api/media/user-avatar/${userId}`;
  } catch (e) {
    console.warn('[avatar-ingest] error', userId, (e as Error)?.message || e);
    return u;
  }
}
