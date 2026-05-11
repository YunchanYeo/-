import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { Db, AuthedAdmin, AuthedUser, RequestContext } from '../types';

function genSessionToken() {
  return crypto.randomBytes(24).toString('hex');
}

function maskMiddle(s: string, keep = 4) {
  const raw = String(s || '').trim();
  if (!raw) return '';
  if (raw.length <= keep * 2) return `${raw.slice(0, 2)}***${raw.slice(-2)}`;
  return `${raw.slice(0, keep)}***${raw.slice(-keep)}`;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    const data = (await res.json().catch(() => null)) as any;
    return { res, data };
  } finally {
    clearTimeout(t);
  }
}

async function postJsonWithTimeout(url: string, body: Record<string, unknown>, timeoutMs: number) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: controller.signal,
    });
    const data = (await res.json().catch(() => null)) as any;
    return { res, data };
  } finally {
    clearTimeout(t);
  }
}

async function withSqliteRetry<T>(fn: () => T, options: { retries?: number; baseDelayMs?: number } = {}) {
  const retries = options.retries ?? 8;
  const baseDelayMs = options.baseDelayMs ?? 80;
  let lastErr: any = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return fn();
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message || '');
      const isLocked = msg.includes('database is locked') || msg.includes('SQLITE_BUSY') || msg.includes('SQLITE_LOCKED');
      if (!isLocked || attempt === retries) throw e;
      const wait = baseDelayMs * (attempt + 1);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
}

function getAuthToken(req: Request) {
  const auth = (req.headers.authorization || '').toString();
  if (!auth.startsWith('Bearer ')) return '';
  return auth.slice(7).trim();
}

function getAdminToken(req: Request) {
  const token = (req.headers['x-admin-token'] || '').toString().trim();
  if (token) return token;
  return getAuthToken(req);
}

export function createAuthService({ db, wechatAppId, wechatAppSecret }: Pick<RequestContext, 'db' | 'wechatAppId' | 'wechatAppSecret'>) {
  let cachedAccessToken = '';
  let cachedAccessTokenExpireAt = 0;
  function requireAuth(req: Request, res: Response, next: NextFunction) {
    const token = getAuthToken(req);
    if (!token) return res.status(401).json({ ok: false, message: 'Missing Authorization token' });
    const user = db
      .prepare(
        `SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
         FROM users WHERE sessionToken = ?`,
      )
      .get(token) as AuthedUser | undefined;
    if (!user) return res.status(401).json({ ok: false, message: 'Invalid session token' });
    (req as any).user = user;
    return next();
  }

  function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const token = getAdminToken(req);
    if (!token) return res.status(401).json({ ok: false, message: 'Missing admin token' });
    const admin = db
      .prepare(
        `SELECT a.id, a.username
         FROM admins a
         LEFT JOIN admin_sessions s ON s.adminId = a.id
         WHERE s.token = ? OR a.sessionToken = ?
         LIMIT 1`,
      )
      .get(token, token) as AuthedAdmin | undefined;
    if (!admin) return res.status(401).json({ ok: false, message: 'Invalid admin token' });
    (req as any).admin = admin;
    return next();
  }

  async function wechatLogin(req: Request, res: Response) {
    try {
      const schema = z.object({
        code: z.string().min(1),
        userInfo: z.object({ nickName: z.string().optional(), avatarUrl: z.string().optional(), gender: z.number().optional() }).optional(),
        miniProgramInfo: z.object({ appId: z.string().optional(), envVersion: z.string().optional(), version: z.string().optional() }).optional(),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid login body', issues: parsed.error.issues });

      const { code, userInfo, miniProgramInfo } = parsed.data;
      let openid = '';
      let unionid = '';

      if (wechatAppId && wechatAppSecret) {
        const clientAppId = String(miniProgramInfo?.appId || '').trim();
        if (clientAppId && clientAppId !== wechatAppId) {
          return res.status(400).json({
            ok: false,
            message: `小程序AppID不一致：client=${maskMiddle(clientAppId)} server=${maskMiddle(wechatAppId)}。请统一开发者工具AppID与服务器WECHAT_APPID`,
          });
        }
        const safeCode = encodeURIComponent(code);
        const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${wechatAppId}&secret=${wechatAppSecret}&js_code=${safeCode}&grant_type=authorization_code`;
        const { data: wxData } = await fetchJsonWithTimeout(url, 8000);
        const errcode = Number(wxData?.errcode || 0);
        if (errcode) {
          const errmsg = String(wxData?.errmsg || 'unknown');
          console.error('[wechatLogin] jscode2session error', {
            errcode,
            errmsg,
            serverAppId: maskMiddle(wechatAppId),
            clientAppId: maskMiddle(clientAppId),
            codePrefix: String(code || '').slice(0, 8),
          });
          return res.status(401).json({
            ok: false,
            message: `wechat jscode2session failed: ${errcode} ${errmsg}`,
            data: { errcode, errmsg },
          });
        }
        openid = String(wxData?.openid || '');
        unionid = String(wxData?.unionid || '');
        if (!openid) {
          return res.status(401).json({
            ok: false,
            message: `wechat jscode2session failed: missing openid`,
          });
        }
      } else {
        return res.status(500).json({
          ok: false,
          message: 'Server missing WECHAT_APPID/WECHAT_APPSECRET',
        });
      }

      const exists = db.prepare(`SELECT id FROM users WHERE openid = ?`).get(openid) as { id: number } | undefined;
      const token = genSessionToken();
      if (exists) {
        await withSqliteRetry(() =>
          db
            .prepare(
              `UPDATE users
               SET unionid = ?, sessionToken = ?, nickName = COALESCE(?, nickName), avatarUrl = COALESCE(?, avatarUrl),
                   gender = COALESCE(?, gender), updatedAt = datetime('now')
               WHERE id = ?`,
            )
            .run(unionid || null, token, userInfo?.nickName ?? null, userInfo?.avatarUrl ?? null, userInfo?.gender ?? null, exists.id),
        );
      } else {
        await withSqliteRetry(() =>
          db
            .prepare(
              `INSERT INTO users (openid, unionid, sessionToken, nickName, avatarUrl, gender, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            )
            .run(openid, unionid || null, token, userInfo?.nickName ?? '', userInfo?.avatarUrl ?? '', userInfo?.gender ?? 0),
        );
      }

      const me = db
        .prepare(
          `SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
           FROM users WHERE openid = ?`,
        )
        .get(openid);
      return res.json({
        ok: true,
        data: { token, user: me, isDevLogin: false },
      });
    } catch (e: any) {
      console.error('[wechatLogin] failed', e);
      return res.status(500).json({ ok: false, message: `wechat login failed: ${e?.message || 'unknown error'}` });
    }
  }

  async function wechatOneClickLogin(req: Request, res: Response) {
    try {
      const schema = z.object({
        loginCode: z.string().min(1),
        phoneCode: z.string().min(1),
        userInfo: z.object({ nickName: z.string().optional(), avatarUrl: z.string().optional(), gender: z.number().optional() }).optional(),
        miniProgramInfo: z.object({ appId: z.string().optional(), envVersion: z.string().optional(), version: z.string().optional() }).optional(),
      });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid oneclick body', issues: parsed.error.issues });

      const { loginCode, phoneCode, userInfo, miniProgramInfo } = parsed.data;
      if (!wechatAppId || !wechatAppSecret) {
        return res.status(500).json({ ok: false, message: 'Server missing WECHAT_APPID/WECHAT_APPSECRET' });
      }
      const clientAppId = String(miniProgramInfo?.appId || '').trim();
      if (clientAppId && clientAppId !== wechatAppId) {
        return res.status(400).json({
          ok: false,
          message: `小程序AppID不一致：client=${maskMiddle(clientAppId)} server=${maskMiddle(wechatAppId)}。请统一开发者工具AppID与服务器WECHAT_APPID`,
        });
      }

      // 1) code2Session → openid
      const safeCode = encodeURIComponent(loginCode);
      const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${wechatAppId}&secret=${wechatAppSecret}&js_code=${safeCode}&grant_type=authorization_code`;
      const { data: wxData } = await fetchJsonWithTimeout(url, 8000);
      const errcode = Number(wxData?.errcode || 0);
      if (errcode) {
        const errmsg = String(wxData?.errmsg || 'unknown');
        console.error('[wechatOneClickLogin] jscode2session error', {
          errcode,
          errmsg,
          serverAppId: maskMiddle(wechatAppId),
          clientAppId: maskMiddle(clientAppId),
          loginCodePrefix: String(loginCode || '').slice(0, 8),
        });
        return res.status(401).json({ ok: false, message: `wechat jscode2session failed: ${errcode} ${errmsg}`, data: { errcode, errmsg } });
      }
      const openid = String(wxData?.openid || '');
      const unionid = String(wxData?.unionid || '');
      if (!openid) return res.status(401).json({ ok: false, message: `wechat jscode2session failed: missing openid` });

      // 2) getPhoneNumber → phone
      const accessToken = await getWechatAccessToken();
      const phoneUrl = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`;
      const { data: phoneData } = await postJsonWithTimeout(phoneUrl, { code: phoneCode }, 8000);
      const pErr = Number(phoneData?.errcode || 0);
      if (pErr) {
        const errmsg = String(phoneData?.errmsg || 'unknown');
        console.error('[wechatOneClickLogin] getPhoneNumber error', {
          errcode: pErr,
          errmsg,
          serverAppId: maskMiddle(wechatAppId),
          clientAppId: maskMiddle(clientAppId),
          phoneCodePrefix: String(phoneCode || '').slice(0, 8),
        });
        return res.status(401).json({ ok: false, message: `wechat getPhoneNumber failed: ${pErr} ${errmsg}`, data: { errcode: pErr, errmsg } });
      }
      const phoneNumber = String(phoneData?.phone_info?.phoneNumber || '');
      if (!phoneNumber) return res.status(401).json({ ok: false, message: 'wechat getPhoneNumber failed: missing phoneNumber' });

      // 3) upsert user + session token
      const token = genSessionToken();
      const exists = db.prepare(`SELECT id FROM users WHERE openid = ?`).get(openid) as { id: number } | undefined;
      if (exists) {
        await withSqliteRetry(() =>
          db
            .prepare(
              `UPDATE users
               SET unionid = ?, sessionToken = ?, phoneNumber = ?, nickName = COALESCE(?, nickName), avatarUrl = COALESCE(?, avatarUrl),
                   gender = COALESCE(?, gender), updatedAt = datetime('now')
               WHERE id = ?`,
            )
            .run(unionid || null, token, phoneNumber, userInfo?.nickName ?? null, userInfo?.avatarUrl ?? null, userInfo?.gender ?? null, exists.id),
        );
      } else {
        await withSqliteRetry(() =>
          db
            .prepare(
              `INSERT INTO users (openid, unionid, sessionToken, nickName, avatarUrl, gender, phoneNumber, createdAt, updatedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
            )
            .run(openid, unionid || null, token, userInfo?.nickName ?? '', userInfo?.avatarUrl ?? '', userInfo?.gender ?? 0, phoneNumber),
        );
      }

      const me = db
        .prepare(
          `SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
           FROM users WHERE openid = ?`,
        )
        .get(openid);

      return res.json({ ok: true, data: { token, user: me } });
    } catch (e: any) {
      console.error('[wechatOneClickLogin] failed', e);
      return res.status(500).json({ ok: false, message: `wechat oneclick failed: ${e?.message || 'unknown error'}` });
    }
  }

  async function getWechatAccessToken() {
    const now = Date.now();
    if (cachedAccessToken && cachedAccessTokenExpireAt > now + 30_000) {
      return cachedAccessToken;
    }
    if (!wechatAppId || !wechatAppSecret) {
      throw new Error('Server missing WECHAT_APPID/WECHAT_APPSECRET');
    }
    const tokenUrl =
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${encodeURIComponent(wechatAppId)}&secret=${encodeURIComponent(wechatAppSecret)}`;
    const { data } = await fetchJsonWithTimeout(tokenUrl, 8000);
    const errcode = Number(data?.errcode || 0);
    if (errcode) {
      throw new Error(`wechat get access_token failed: ${errcode} ${String(data?.errmsg || 'unknown')}`);
    }
    const accessToken = String(data?.access_token || '');
    const expiresIn = Math.max(60, Number(data?.expires_in || 7200));
    if (!accessToken) throw new Error('wechat get access_token failed: missing access_token');
    cachedAccessToken = accessToken;
    cachedAccessTokenExpireAt = now + expiresIn * 1000;
    return accessToken;
  }

  async function bindWechatPhone(req: Request, res: Response) {
    try {
      const user = (req as any).user as AuthedUser | undefined;
      if (!user?.id) return res.status(401).json({ ok: false, message: 'Unauthorized' });
      const schema = z.object({ code: z.string().min(1) });
      const parsed = schema.safeParse(req.body || {});
      if (!parsed.success) {
        return res.status(400).json({ ok: false, message: 'Invalid phone bind body', issues: parsed.error.issues });
      }
      const accessToken = await getWechatAccessToken();
      const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${encodeURIComponent(accessToken)}`;
      const { data: wxData } = await postJsonWithTimeout(url, { code: parsed.data.code }, 8000);
      const errcode = Number(wxData?.errcode || 0);
      if (errcode) {
        const errmsg = String(wxData?.errmsg || 'unknown');
        return res.status(401).json({ ok: false, message: `wechat getPhoneNumber failed: ${errcode} ${errmsg}`, data: { errcode, errmsg } });
      }
      const phoneNumber = String(wxData?.phone_info?.phoneNumber || '');
      if (!phoneNumber) {
        return res.status(401).json({ ok: false, message: 'wechat getPhoneNumber failed: missing phoneNumber' });
      }
      await withSqliteRetry(() =>
        db.prepare(`UPDATE users SET phoneNumber = ?, updatedAt = datetime('now') WHERE id = ?`).run(phoneNumber, user.id),
      );
      const me = db
        .prepare(
          `SELECT id, ('CUS' || printf('%08d', id)) AS customerId, openid, nickName, avatarUrl, gender, phoneNumber, points
           FROM users WHERE id = ?`,
        )
        .get(user.id);
      return res.json({ ok: true, data: { user: me } });
    } catch (e: any) {
      console.error('[bindWechatPhone] failed', e);
      return res.status(500).json({ ok: false, message: `wechat phone bind failed: ${e?.message || 'unknown error'}` });
    }
  }

  /**
   * 管理员登录：校验 SQLite `admins` 表中的 passwordHash（bcrypt）或明文 password（首次登录后会升级为哈希）。
   */
  async function adminLogin(req: Request, res: Response) {
    const schema = z.object({ username: z.string().min(1), password: z.string().min(1) });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid admin login body', issues: parsed.error.issues });
    const username = parsed.data.username.trim();
    const { password } = parsed.data;
    const admin = db.prepare(`SELECT id, username, password, passwordHash FROM admins WHERE username = ?`).get(username) as
      | { id: number; username: string; password: string | null; passwordHash: string | null }
      | undefined;
    if (!admin) return res.status(401).json({ ok: false, message: '管理员账号或密码错误' });
    let ok = false;
    if (admin.passwordHash) {
      ok = await bcrypt.compare(password, admin.passwordHash);
    } else if (admin.password) {
      ok = admin.password === password;
      if (ok) {
        const nextHash = await bcrypt.hash(password, 10);
        db.prepare(`UPDATE admins SET passwordHash = ?, updatedAt = datetime('now') WHERE id = ?`).run(nextHash, admin.id);
      }
    }
    if (!ok) return res.status(401).json({ ok: false, message: '管理员账号或密码错误' });
    const token = genSessionToken();
    const tx = db.transaction((adminId: number, tk: string) => {
      // 같은 계정 재로그인 시 이전 세션 강제 종료
      db.prepare(`DELETE FROM admin_sessions WHERE adminId = ?`).run(adminId);
      db.prepare(
        `INSERT INTO admin_sessions (adminId, token, createdAt, updatedAt)
         VALUES (?, ?, datetime('now'), datetime('now'))`,
      ).run(adminId, tk);
      // 구버전 호환 fallback
      db.prepare(`UPDATE admins SET sessionToken = ?, updatedAt = datetime('now') WHERE id = ?`).run(tk, adminId);
    });
    tx(admin.id, token);
    return res.json({ ok: true, data: { token, admin: { id: admin.id, username: admin.username } } });
  }

  return { requireAuth, requireAdmin, wechatLogin, wechatOneClickLogin, bindWechatPhone, adminLogin };
}
