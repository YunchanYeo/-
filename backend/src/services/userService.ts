import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Db } from '../types';
import { normalizeUserAvatarForStorage } from '../lib/normalizeUserAvatarForStorage';

export function createUserService({ db }: { db: Db }) {
  function me(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const user = db
      .prepare(
        `SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
         FROM users WHERE id = ?`,
      )
      .get(userId);
    return res.json({ ok: true, data: user });
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
        let avatarStored: string | null | undefined;
        if (avatarUrl !== undefined) {
          avatarStored = await normalizeUserAvatarForStorage(db, userId, avatarUrl);
        }
        db.prepare(
          `UPDATE users
       SET nickName = COALESCE(?, nickName),
           avatarUrl = COALESCE(?, avatarUrl),
           gender = COALESCE(?, gender),
           phoneNumber = COALESCE(?, phoneNumber),
           updatedAt = datetime('now')
       WHERE id = ?`,
        ).run(nickName ?? null, avatarStored === undefined ? null : avatarStored, gender ?? null, phoneNumber ?? null, userId);
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
