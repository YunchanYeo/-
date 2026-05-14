import type { Request, Response } from 'express';
import type { Db } from '../types';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

/** 防止 SSRF：拒绝内网/回环主机名 */
function isBlockedAvatarProxyHost(hostname: string): boolean {
  const h = String(hostname || '').toLowerCase();
  if (!h || h === 'localhost') return true;
  if (h.endsWith('.localhost') || h.endsWith('.local')) return true;
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const o = (i: number) => Number(m[i]);
  if (o(1) === 10) return true;
  if (o(1) === 127) return true;
  if (o(1) === 0) return true;
  if (o(1) === 169 && o(2) === 254) return true;
  if (o(1) === 192 && o(2) === 168) return true;
  if (o(1) === 172 && o(2) >= 16 && o(2) <= 31) return true;
  return false;
}

function mayProxyExternalAvatarUrl(raw: string): boolean {
  const u = String(raw || '').trim();
  if (!u.startsWith('http')) return false;
  if (u.includes('/api/media/user-avatar/')) return false;
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return false;
    if (isBlockedAvatarProxyHost(x.hostname)) return false;
    if (x.protocol === 'http:' && x.hostname !== '127.0.0.1' && x.hostname !== 'localhost') return false;
    return true;
  } catch {
    return false;
  }
}

async function fetchRemoteAvatarBuffer(url: string): Promise<{ mime: string; buf: Buffer } | null> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 12_000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'WeChatShopBackend/1.0' },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (!buf.length || buf.length > MAX_AVATAR_BYTES) return null;
    const rawMime = res.headers.get('content-type') || 'image/jpeg';
    let mime = (rawMime.split(';')[0] || 'image/jpeg').trim().toLowerCase();
    if (!mime.startsWith('image/')) mime = 'image/jpeg';
    return { mime, buf };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** 用户头像 BLOB；无 BLOB 时从 users.avatarUrl 拉取并代理（小程序仅需业务域名为合法域名） */
export function createUserAvatarMediaService({ db }: { db: Db }) {
  function serveUserAvatar(req: Request, res: Response) {
    void serveUserAvatarAsync(req, res).catch((e) => {
      console.error('[user-avatar]', e);
      if (!res.headersSent) res.status(500).end();
    });
  }

  async function serveUserAvatarAsync(req: Request, res: Response) {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(400).end();
      return;
    }
    const row = db
      .prepare(`SELECT mimeType, data FROM user_avatar_media WHERE userId = ?`)
      .get(userId) as { mimeType: string; data: Buffer } | undefined;
    if (row?.data?.length) {
      const mime = String(row.mimeType || 'image/jpeg').trim() || 'image/jpeg';
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(row.data);
      return;
    }

    const urow = db.prepare(`SELECT avatarUrl FROM users WHERE id = ?`).get(userId) as { avatarUrl: string | null } | undefined;
    const rawUrl = String(urow?.avatarUrl ?? '').trim();
    if (!rawUrl || rawUrl.startsWith('/api/media/user-avatar/')) {
      res.status(404).end();
      return;
    }
    if (!mayProxyExternalAvatarUrl(rawUrl)) {
      res.status(404).end();
      return;
    }

    const proxied = await fetchRemoteAvatarBuffer(rawUrl);
    if (!proxied) {
      res.status(404).end();
      return;
    }
    res.setHeader('Content-Type', proxied.mime);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(proxied.buf);
  }

  return { serveUserAvatar };
}
