import { z } from 'zod';
export function createUserService({ db }) {
    function me(req, res) {
        const userId = req.user?.id;
        const user = db
            .prepare(`SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
         FROM users WHERE id = ?`)
            .get(userId);
        return res.json({ ok: true, data: user });
    }
    function updateMe(req, res) {
        const userId = req.user?.id;
        const schema = z.object({
            nickName: z.string().optional(),
            avatarUrl: z.string().optional(),
            gender: z.number().optional(),
            phoneNumber: z.string().optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid profile body', issues: parsed.error.issues });
        const { nickName, avatarUrl, gender, phoneNumber } = parsed.data;
        db.prepare(`UPDATE users
       SET nickName = COALESCE(?, nickName),
           avatarUrl = COALESCE(?, avatarUrl),
           gender = COALESCE(?, gender),
           phoneNumber = COALESCE(?, phoneNumber),
           updatedAt = datetime('now')
       WHERE id = ?`).run(nickName ?? null, avatarUrl ?? null, gender ?? null, phoneNumber ?? null, userId);
        const meRow = db
            .prepare(`SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
         FROM users WHERE id = ?`)
            .get(userId);
        return res.json({ ok: true, data: meRow });
    }
    return { me, updateMe };
}
