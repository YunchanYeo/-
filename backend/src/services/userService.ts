import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Db } from '../types';
import { isLikelyWeChatAvatarCdnUrl, normalizeUserAvatarForStorage } from '../lib/normalizeUserAvatarForStorage';
import { avatarUrlForSqlUpdate, nickNameForSqlUpdate } from '../lib/coalesceWechatProfile';

export function createUserService({ db }: { db: Db }) {
  function me(req: Request, res: Response) {
    void (async () => {
      try {
        const userId = (req as any).user?.id;
        let user: any = db
          .prepare(
            `SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
         FROM users WHERE id = ?`,
          )
          .get(userId);
        if (user?.id && isLikelyWeChatAvatarCdnUrl(String(user.avatarUrl || ''))) {
          const next = await normalizeUserAvatarForStorage(db, user.id, String(user.avatarUrl || ''));
          if (next !== user.avatarUrl) {
            db.prepare(`UPDATE users SET avatarUrl = ?, updatedAt = datetime('now') WHERE id = ?`).run(next, user.id);
            user = db
              .prepare(
                `SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
         FROM users WHERE id = ?`,
              )
              .get(userId);
          }
        }
        res.json({ ok: true, data: user });
      } catch (e: any) {
        console.error('[me]', e);
        res.status(500).json({ ok: false, message: e?.message || 'failed' });
      }
    })();
  }

  function updateMe(req: Request, res: Response) {
    void (async () => {
      try {
        const userId = (req as any).user?.id;
        const schema = z.object({
          nickName: z.string().optional(),
          avatarUrl: z.string().optional(),
          gender: z.number().optional(),
          phoneNumber: z.string().optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success) {
          res.status(400).json({ ok: false, message: 'Invalid profile body', issues: parsed.error.issues });
          return;
        }
        const { nickName, avatarUrl, gender, phoneNumber } = parsed.data;
        const nickForSql = nickName !== undefined ? nickNameForSqlUpdate(nickName) : null;
        const phoneForSql =
          phoneNumber !== undefined ? (String(phoneNumber).trim() || null) : null;
        let avatarStored: string | null | undefined;
        if (avatarUrl !== undefined) {
          const av = avatarUrlForSqlUpdate(avatarUrl);
          if (av === null) avatarStored = null;
          else avatarStored = await normalizeUserAvatarForStorage(db, userId, av);
        }
        db.prepare(
          `UPDATE users
       SET nickName = COALESCE(?, nickName),
           avatarUrl = COALESCE(?, avatarUrl),
           gender = COALESCE(?, gender),
           phoneNumber = COALESCE(?, phoneNumber),
           updatedAt = datetime('now')
       WHERE id = ?`,
        ).run(nickForSql, avatarStored === undefined ? null : avatarStored, gender ?? null, phoneForSql, userId);
        const meRow = db
          .prepare(
            `SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
         FROM users WHERE id = ?`,
          )
          .get(userId);
        res.json({ ok: true, data: meRow });
      } catch (e: any) {
        console.error('[updateMe]', e);
        res.status(500).json({ ok: false, message: e?.message || 'update failed' });
      }
    })();
  }

  return { me, updateMe };
}
