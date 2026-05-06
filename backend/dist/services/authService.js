import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
function genSessionToken() {
    return crypto.randomBytes(24).toString('hex');
}
async function withSqliteRetry(fn, options = {}) {
    const retries = options.retries ?? 8;
    const baseDelayMs = options.baseDelayMs ?? 80;
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
            return fn();
        }
        catch (e) {
            lastErr = e;
            const msg = String(e?.message || '');
            const isLocked = msg.includes('database is locked') || msg.includes('SQLITE_BUSY') || msg.includes('SQLITE_LOCKED');
            if (!isLocked || attempt === retries)
                throw e;
            const wait = baseDelayMs * (attempt + 1);
            await new Promise((r) => setTimeout(r, wait));
        }
    }
    throw lastErr;
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
            .prepare(`SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
         FROM users WHERE sessionToken = ?`)
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
        try {
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
                    // 在开发/网络受限环境下，微信接口可能不可达。此时不直接让登录失败，而是回退到 dev openid，保证小程序可用。
                    // 生产环境建议配置正确的 WECHAT_APPID/WECHAT_APPSECRET，并观察 isDevLogin=false。
                    if (wxData.errcode) {
                        openid = `dev_${crypto.createHash('sha256').update(code).digest('hex').slice(0, 24)}`;
                        unionid = '';
                    }
                    else {
                        openid = wxData.openid;
                        unionid = wxData.unionid || '';
                    }
                }
                catch (e) {
                    openid = `dev_${crypto.createHash('sha256').update(code).digest('hex').slice(0, 24)}`;
                    unionid = '';
                }
            }
            else {
                openid = `dev_${crypto.createHash('sha256').update(code).digest('hex').slice(0, 24)}`;
            }
            const exists = db.prepare(`SELECT id FROM users WHERE openid = ?`).get(openid);
            const token = genSessionToken();
            if (exists) {
                await withSqliteRetry(() => db
                    .prepare(`UPDATE users
               SET unionid = ?, sessionToken = ?, nickName = COALESCE(?, nickName), avatarUrl = COALESCE(?, avatarUrl),
                   gender = COALESCE(?, gender), updatedAt = datetime('now')
               WHERE id = ?`)
                    .run(unionid || null, token, userInfo?.nickName ?? null, userInfo?.avatarUrl ?? null, userInfo?.gender ?? null, exists.id));
            }
            else {
                await withSqliteRetry(() => db
                    .prepare(`INSERT INTO users (openid, unionid, sessionToken, nickName, avatarUrl, gender, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
                    .run(openid, unionid || null, token, userInfo?.nickName ?? '', userInfo?.avatarUrl ?? '', userInfo?.gender ?? 0));
            }
            const me = db
                .prepare(`SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
           FROM users WHERE openid = ?`)
                .get(openid);
            return res.json({
                ok: true,
                data: { token, user: me, isDevLogin: openid.startsWith('dev_') || !(wechatAppId && wechatAppSecret) },
            });
        }
        catch (e) {
            console.error('[wechatLogin] failed', e);
            return res.status(500).json({ ok: false, message: `wechat login failed: ${e?.message || 'unknown error'}` });
        }
    }
    /**
     * 管理员登录：校验 SQLite `admins` 表中的 passwordHash（bcrypt）或明文 password（首次登录后会升级为哈希）。
     */
    async function adminLogin(req, res) {
        const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid admin login body', issues: parsed.error.issues });
        const username = parsed.data.username.trim();
        const { password } = parsed.data;
        const admin = db.prepare(`SELECT id, username, password, passwordHash FROM admins WHERE username = ?`).get(username);
        if (!admin)
            return res.status(401).json({ ok: false, message: '管理员账号或密码错误' });
        let ok = false;
        if (admin.passwordHash) {
            ok = await bcrypt.compare(password, admin.passwordHash);
        }
        else if (admin.password) {
            ok = admin.password === password;
            if (ok) {
                const nextHash = await bcrypt.hash(password, 10);
                db.prepare(`UPDATE admins SET passwordHash = ?, updatedAt = datetime('now') WHERE id = ?`).run(nextHash, admin.id);
            }
        }
        if (!ok)
            return res.status(401).json({ ok: false, message: '管理员账号或密码错误' });
        const token = genSessionToken();
        db.prepare(`UPDATE admins SET sessionToken = ?, updatedAt = datetime('now') WHERE id = ?`).run(token, admin.id);
        return res.json({ ok: true, data: { token, admin: { id: admin.id, username: admin.username } } });
    }
    return { requireAuth, requireAdmin, wechatLogin, adminLogin };
}
