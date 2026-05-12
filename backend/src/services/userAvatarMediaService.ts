import type { Request, Response } from 'express';
import type { Db } from '../types';

/** 用户头像 BLOB — 与商品图相同域名，小程序 download 合法域名只需业务 HTTPS 根域 */
export function createUserAvatarMediaService({ db }: { db: Db }) {
  function serveUserAvatar(req: Request, res: Response) {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId) || userId < 1) {
      res.status(400).end();
      return;
    }
    const row = db
      .prepare(`SELECT mimeType, data FROM user_avatar_media WHERE userId = ?`)
      .get(userId) as { mimeType: string; data: Buffer } | undefined;
    if (!row?.data?.length) {
      res.status(404).end();
      return;
    }
    const mime = String(row.mimeType || 'image/jpeg').trim() || 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(row.data);
  }

  return { serveUserAvatar };
}
