import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { z } from 'zod';
export function createAdminService({ db, uploadsDir }) {
    function adminMe(req, res) {
        const adminId = req.admin?.id;
        const admin = db.prepare(`SELECT id, username, createdAt, updatedAt FROM admins WHERE id = ?`).get(adminId);
        return res.json({ ok: true, data: admin });
    }
    /**
     * Update admin password using bcrypt hash storage.
     */
    async function adminUpdatePassword(req, res) {
        const schema = z.object({
            currentPassword: z.string().min(1),
            newPassword: z.string().min(6),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid password body', issues: parsed.error.issues });
        const adminId = req.admin?.id;
        const row = db
            .prepare(`SELECT id, password, passwordHash FROM admins WHERE id = ?`)
            .get(adminId);
        if (!row)
            return res.status(401).json({ ok: false, message: '当前密码错误' });
        const currentOk = row.passwordHash
            ? await bcrypt.compare(parsed.data.currentPassword, row.passwordHash)
            : row.password === parsed.data.currentPassword;
        if (!currentOk)
            return res.status(401).json({ ok: false, message: '当前密码错误' });
        const nextHash = await bcrypt.hash(parsed.data.newPassword, 10);
        db.prepare(`UPDATE admins SET passwordHash = ?, sessionToken = NULL, updatedAt = datetime('now') WHERE id = ?`).run(nextHash, adminId);
        return res.json({ ok: true, data: { ok: true } });
    }
    /**
     * Update admin username after password verification.
     */
    async function adminUpdateUsername(req, res) {
        const schema = z.object({
            newUsername: z.string().min(4),
            currentPassword: z.string().min(1),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid username body', issues: parsed.error.issues });
        const adminId = req.admin?.id;
        const row = db
            .prepare(`SELECT id, password, passwordHash FROM admins WHERE id = ?`)
            .get(adminId);
        if (!row)
            return res.status(401).json({ ok: false, message: '当前密码错误' });
        const currentOk = row.passwordHash
            ? await bcrypt.compare(parsed.data.currentPassword, row.passwordHash)
            : row.password === parsed.data.currentPassword;
        if (!currentOk)
            return res.status(401).json({ ok: false, message: '当前密码错误' });
        const exists = db.prepare(`SELECT id FROM admins WHERE username = ?`).get(parsed.data.newUsername);
        if (exists)
            return res.status(409).json({ ok: false, message: '该用户名已被使用' });
        db.prepare(`UPDATE admins SET username = ?, sessionToken = NULL, updatedAt = datetime('now') WHERE id = ?`).run(parsed.data.newUsername, adminId);
        return res.json({ ok: true, data: { ok: true } });
    }
    function adminOrders(req, res) {
        const rows = db
            .prepare(`SELECT o.id, o.orderNo, o.userId, o.totalAmount, o.paymentAmount, o.refundAmount, o.refundStatus,
                o.orderStatus, o.orderStatusName, o.itemsJson, o.addressJson, o.createdAt,
                o.logisticsCompanyCode, o.logisticsCompanyName, o.logisticsNo, o.logisticsRemark, o.shippedAt,
                u.nickName, u.phoneNumber
         FROM orders o
         LEFT JOIN users u ON u.id = o.userId
         ORDER BY o.id DESC`)
            .all();
        const data = rows.map((row) => ({ ...row, items: JSON.parse(row.itemsJson || '[]'), address: JSON.parse(row.addressJson || '{}') }));
        return res.json({ ok: true, data });
    }
    function adminUpdateOrderShipping(req, res) {
        const schema = z.object({
            logisticsCompanyCode: z.string().optional(),
            logisticsCompanyName: z.string().min(1),
            logisticsNo: z.string().min(1),
            logisticsRemark: z.string().optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid shipping body', issues: parsed.error.issues });
        const order = db.prepare(`SELECT * FROM orders WHERE orderNo = ?`).get(req.params.orderNo);
        if (!order)
            return res.status(404).json({ ok: false, message: 'Order not found' });
        db.prepare(`UPDATE orders
       SET logisticsCompanyCode = ?,
           logisticsCompanyName = ?,
           logisticsNo = ?,
           logisticsRemark = ?,
           shippedAt = datetime('now'),
           orderStatus = CASE WHEN orderStatus < 20 THEN 20 ELSE orderStatus END,
           orderStatusName = CASE WHEN orderStatusName = '待发货' THEN '待收货' ELSE orderStatusName END,
           updatedAt = datetime('now')
       WHERE orderNo = ?`).run(parsed.data.logisticsCompanyCode ?? '', parsed.data.logisticsCompanyName, parsed.data.logisticsNo, parsed.data.logisticsRemark ?? '', req.params.orderNo);
        const updated = db
            .prepare(`SELECT id, orderNo, logisticsCompanyCode, logisticsCompanyName, logisticsNo, logisticsRemark, shippedAt,
                orderStatus, orderStatusName
         FROM orders WHERE orderNo = ?`)
            .get(req.params.orderNo);
        return res.json({ ok: true, data: updated });
    }
    function adminUploadImage(req, res) {
        const schema = z.object({
            fileName: z.string().optional(),
            mimeType: z.string().optional(),
            base64Data: z.string().min(1),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid upload body', issues: parsed.error.issues });
        const { fileName = '', mimeType = 'image/jpeg', base64Data } = parsed.data;
        const extFromMime = mimeType.includes('png') ? 'png' : mimeType.includes('webp') ? 'webp' : 'jpg';
        const safeBaseName = String(fileName || 'upload').replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 40);
        const finalName = `${Date.now()}_${safeBaseName || 'img'}_${crypto.randomInt(1000, 9999)}.${extFromMime}`;
        const targetPath = path.join(uploadsDir, finalName);
        try {
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(targetPath, buffer);
        }
        catch (e) {
            return res.status(500).json({ ok: false, message: 'Image save failed' });
        }
        const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${finalName}`;
        return res.json({ ok: true, data: { imageUrl } });
    }
    return {
        adminMe,
        adminUpdatePassword,
        adminUpdateUsername,
        adminOrders,
        adminUpdateOrderShipping,
        adminUploadImage,
    };
}
