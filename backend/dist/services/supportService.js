import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
const MSG_SELECT = `id, userId, fromRole, msgType, content, metaJson, adminRead, userRead, createdAt`;
function parseMeta(metaJson) {
    if (!metaJson)
        return null;
    try {
        const v = JSON.parse(metaJson);
        return typeof v === 'object' && v !== null ? v : null;
    }
    catch {
        return null;
    }
}
function rowWithParsed(row) {
    return { ...row, meta: parseMeta(row.metaJson) };
}
export function createSupportService({ db, uploadsDir }) {
    /**
     * Saves uploaded chat media (base64) and returns an absolute URL served under `/uploads`.
     */
    function saveChatMedia(params) {
        const { kind, mimeType, fileName, base64Data, req } = params;
        let ext = 'bin';
        if (kind === 'image') {
            ext = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        }
        else {
            if (mimeType.includes('mpeg') || mimeType.includes('mp3'))
                ext = 'mp3';
            else if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac'))
                ext = 'm4a';
            else if (mimeType.includes('wav'))
                ext = 'wav';
            else
                ext = 'mp3';
        }
        const safeBaseName = String(fileName || 'upload')
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9-_]/g, '')
            .slice(0, 40);
        const prefix = kind === 'image' ? 'chat_img' : 'chat_voice';
        const finalName = `${prefix}_${Date.now()}_${safeBaseName || kind}_${crypto.randomInt(1000, 9999)}.${ext}`;
        const targetPath = path.join(uploadsDir, finalName);
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(targetPath, buffer);
        const url = `${req.protocol}://${req.get('host')}/uploads/${finalName}`;
        return url;
    }
    function uploadMediaBody(req, res) {
        const schema = z.object({
            kind: z.enum(['image', 'voice']),
            fileName: z.string().optional(),
            mimeType: z.string().optional(),
            base64Data: z.string().min(1),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid upload body', issues: parsed.error.issues });
        const { kind, fileName = '', mimeType = kind === 'image' ? 'image/jpeg' : 'audio/mpeg', base64Data } = parsed.data;
        try {
            const url = saveChatMedia({ kind, mimeType, fileName, base64Data, req });
            return res.json({ ok: true, data: { url } });
        }
        catch {
            return res.status(500).json({ ok: false, message: '文件保存失败' });
        }
    }
    function uploadMyMedia(req, res) {
        return uploadMediaBody(req, res);
    }
    function uploadAdminMedia(req, res) {
        return uploadMediaBody(req, res);
    }
    const messageBodySchema = z.object({
        msgType: z.enum(['text', 'image', 'voice']).optional(),
        content: z.string().min(1).max(8000),
        meta: z
            .object({
            durationMs: z.number().int().positive().max(600000).optional(),
        })
            .optional(),
    });
    function normalizeInsertPayload(body) {
        const msgType = body.msgType || 'text';
        const content = body.content.trim();
        const metaJson = body.meta && Object.keys(body.meta).length > 0 ? JSON.stringify(body.meta) : null;
        if (msgType === 'text') {
            if (content.length > 2000)
                throw new Error('TEXT_TOO_LONG');
            return { msgType: 'text', content, metaJson };
        }
        if (!/^https?:\/\//i.test(content))
            throw new Error('INVALID_MEDIA_URL');
        return { msgType, content, metaJson };
    }
    function listMyMessages(req, res) {
        const userId = req.user?.id;
        const rows = db
            .prepare(`SELECT ${MSG_SELECT}
         FROM support_messages
         WHERE userId = ?
         ORDER BY id ASC`)
            .all(userId);
        db.prepare(`UPDATE support_messages SET userRead = 1 WHERE userId = ? AND fromRole = 'admin'`).run(userId);
        return res.json({ ok: true, data: rows.map(rowWithParsed) });
    }
    function createMyMessage(req, res) {
        const userId = req.user?.id;
        const parsed = messageBodySchema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid support message body', issues: parsed.error.issues });
        let payload;
        try {
            payload = normalizeInsertPayload(parsed.data);
        }
        catch (e) {
            const code = e?.message;
            if (code === 'TEXT_TOO_LONG')
                return res.status(400).json({ ok: false, message: '文字过长' });
            if (code === 'INVALID_MEDIA_URL')
                return res.status(400).json({ ok: false, message: '无效的媒体地址' });
            return res.status(400).json({ ok: false, message: '消息无效' });
        }
        const result = db
            .prepare(`INSERT INTO support_messages (userId, fromRole, content, adminRead, userRead, msgType, metaJson, createdAt)
         VALUES (?, 'user', ?, 0, 1, ?, ?, datetime('now'))`)
            .run(userId, payload.content, payload.msgType, payload.metaJson);
        const created = db
            .prepare(`SELECT ${MSG_SELECT} FROM support_messages WHERE id = ?`)
            .get(result.lastInsertRowid);
        return res.json({ ok: true, data: rowWithParsed(created) });
    }
    function adminConversations(req, res) {
        const rows = db
            .prepare(`SELECT
           u.id as userId,
           u.nickName,
           u.avatarUrl,
           MAX(m.id) as lastMessageId,
           SUM(CASE WHEN m.fromRole = 'user' AND m.adminRead = 0 THEN 1 ELSE 0 END) as unreadCount
         FROM support_messages m
         INNER JOIN users u ON u.id = m.userId
         GROUP BY u.id, u.nickName, u.avatarUrl
         ORDER BY lastMessageId DESC`)
            .all();
        return res.json({ ok: true, data: rows });
    }
    function adminMessagesByUser(req, res) {
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId))
            return res.status(400).json({ ok: false, message: 'Invalid userId' });
        const rows = db
            .prepare(`SELECT ${MSG_SELECT}
         FROM support_messages
         WHERE userId = ?
         ORDER BY id ASC`)
            .all(userId);
        db.prepare(`UPDATE support_messages SET adminRead = 1 WHERE userId = ? AND fromRole = 'user'`).run(userId);
        return res.json({ ok: true, data: rows.map(rowWithParsed) });
    }
    function adminReply(req, res) {
        const userId = Number(req.params.userId);
        if (!Number.isFinite(userId))
            return res.status(400).json({ ok: false, message: 'Invalid userId' });
        const parsed = messageBodySchema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid support message body', issues: parsed.error.issues });
        const exists = db.prepare(`SELECT id FROM users WHERE id = ?`).get(userId);
        if (!exists)
            return res.status(404).json({ ok: false, message: 'User not found' });
        let payload;
        try {
            payload = normalizeInsertPayload(parsed.data);
        }
        catch (e) {
            const code = e?.message;
            if (code === 'TEXT_TOO_LONG')
                return res.status(400).json({ ok: false, message: '文字过长' });
            if (code === 'INVALID_MEDIA_URL')
                return res.status(400).json({ ok: false, message: '无效的媒体地址' });
            return res.status(400).json({ ok: false, message: '消息无效' });
        }
        const result = db
            .prepare(`INSERT INTO support_messages (userId, fromRole, content, adminRead, userRead, msgType, metaJson, createdAt)
         VALUES (?, 'admin', ?, 1, 0, ?, ?, datetime('now'))`)
            .run(userId, payload.content, payload.msgType, payload.metaJson);
        const created = db
            .prepare(`SELECT ${MSG_SELECT} FROM support_messages WHERE id = ?`)
            .get(result.lastInsertRowid);
        return res.json({ ok: true, data: rowWithParsed(created) });
    }
    return {
        listMyMessages,
        createMyMessage,
        adminConversations,
        adminMessagesByUser,
        adminReply,
        uploadMyMedia,
        uploadAdminMedia,
    };
}
