import crypto from 'node:crypto';
import { z } from 'zod';
function genSessionToken() {
    return crypto.randomBytes(24).toString('hex');
}
function getAuthToken(req) {
    const auth = (req.headers.authorization || '').toString();
    if (!auth.startsWith('Bearer '))
        return '';
    return auth.slice(7).trim();
}
function getAdminToken(req) {
    const token = (req.headers['x-admin-token'] || '').toString().trim();
    if (token)
        return token;
    return getAuthToken(req);
}
export function createAuthService({ db, wechatAppId, wechatAppSecret }) {
    function requireAuth(req, res, next) {
        const token = getAuthToken(req);
        if (!token)
            return res.status(401).json({ ok: false, message: 'Missing Authorization token' });
        const user = db
            .prepare(`SELECT id, openid, nickName, avatarUrl, gender, phoneNumber FROM users WHERE sessionToken = ?`)
            .get(token);
        if (!user)
            return res.status(401).json({ ok: false, message: 'Invalid session token' });
        req.user = user;
        return next();
    }
    function requireAdmin(req, res, next) {
        const token = getAdminToken(req);
        if (!token)
            return res.status(401).json({ ok: false, message: 'Missing admin token' });
        const admin = db.prepare(`SELECT id, username FROM admins WHERE sessionToken = ?`).get(token);
        if (!admin)
            return res.status(401).json({ ok: false, message: 'Invalid admin token' });
        req.admin = admin;
        return next();
    }
    async function wechatLogin(req, res) {
        const schema = z.object({
            code: z.string().min(1),
            userInfo: z.object({ nickName: z.string().optional(), avatarUrl: z.string().optional(), gender: z.number().optional() }).optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid login body', issues: parsed.error.issues });
        const { code, userInfo } = parsed.data;
        let openid = '';
        let unionid = '';
        if (wechatAppId && wechatAppSecret) {
            const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${wechatAppId}&secret=${wechatAppSecret}&js_code=${code}&grant_type=authorization_code`;
            try {
                const wxRes = await fetch(url);
                const wxData = await wxRes.json();
                if (wxData.errcode)
                    return res.status(400).json({ ok: false, message: `wechat login failed: ${wxData.errmsg}` });
                openid = wxData.openid;
                unionid = wxData.unionid || '';
            }
            catch (e) {
                return res.status(500).json({ ok: false, message: 'wechat login request failed' });
            }
        }
        else {
            openid = `dev_${crypto.createHash('sha256').update(code).digest('hex').slice(0, 24)}`;
        }
        const exists = db.prepare(`SELECT id FROM users WHERE openid = ?`).get(openid);
        const token = genSessionToken();
        if (exists) {
            db.prepare(`UPDATE users
         SET unionid = ?, sessionToken = ?, nickName = COALESCE(?, nickName), avatarUrl = COALESCE(?, avatarUrl),
             gender = COALESCE(?, gender), updatedAt = datetime('now')
         WHERE id = ?`).run(unionid || null, token, userInfo?.nickName ?? null, userInfo?.avatarUrl ?? null, userInfo?.gender ?? null, exists.id);
        }
        else {
            db.prepare(`INSERT INTO users (openid, unionid, sessionToken, nickName, avatarUrl, gender, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).run(openid, unionid || null, token, userInfo?.nickName ?? '', userInfo?.avatarUrl ?? '', userInfo?.gender ?? 0);
        }
        const me = db.prepare(`SELECT id, openid, nickName, avatarUrl, gender, phoneNumber FROM users WHERE openid = ?`).get(openid);
        return res.json({
            ok: true,
            data: { token, user: me, isDevLogin: !(wechatAppId && wechatAppSecret) },
        });
    }
    function adminLogin(req, res) {
        const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid admin login body', issues: parsed.error.issues });
        const { username, password } = parsed.data;
        const admin = db.prepare(`SELECT id, username FROM admins WHERE username = ? AND password = ?`).get(username, password);
        if (!admin)
            return res.status(401).json({ ok: false, message: '管理员账号或密码错误' });
        const token = genSessionToken();
        db.prepare(`UPDATE admins SET sessionToken = ?, updatedAt = datetime('now') WHERE id = ?`).run(token, admin.id);
        return res.json({ ok: true, data: { token, admin: { id: admin.id, username: admin.username } } });
    }
    return { requireAuth, requireAdmin, wechatLogin, adminLogin };
}
