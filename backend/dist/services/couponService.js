import { z } from 'zod';
function nowMs() {
    return Date.now();
}
function mapUserCoupon(row) {
    const expired = Number(row.endTime || 0) > 0 && Number(row.endTime) < nowMs();
    const computedStatus = row.ucStatus === 'used' ? 'useless' : expired || row.cStatus !== 'enabled' ? 'disabled' : 'default';
    return {
        id: row.userCouponId,
        couponId: row.couponId,
        title: row.name,
        name: row.name,
        type: row.type === 2 ? 'price' : 'discount',
        value: Number(row.value || 0),
        base: Number(row.base || 0),
        startTime: Number(row.startTime || 0),
        endTime: Number(row.endTime || 0),
        status: computedStatus,
        assignedAt: row.assignedAt,
        usedAt: row.usedAt,
        desc: row.type === 2
            ? `减免 ${Number(row.value || 0) / 100} 元${Number(row.base || 0) > 0 ? `，满${Number(row.base || 0) / 100}元可用` : ''}`
            : `${Number(row.value || 0) / 10}折${Number(row.base || 0) > 0 ? `，满${Number(row.base || 0) / 100}元可用` : ''}`,
    };
}
export function createCouponService({ db }) {
    function listMyCoupons(req, res) {
        const userId = req.user?.id;
        const status = String(req.query?.status || 'default');
        const rows = db
            .prepare(`SELECT
          uc.id as userCouponId, uc.couponId, uc.status as ucStatus, uc.assignedAt, uc.usedAt,
          c.name, c.type, c.value, c.base, c.status as cStatus, c.startTime, c.endTime
        FROM user_coupons uc
        INNER JOIN coupons c ON c.id = uc.couponId
        WHERE uc.userId = ?
        ORDER BY uc.id DESC`)
            .all(userId);
        const all = rows.map(mapUserCoupon);
        const filtered = status === 'default' || status === 'useless' || status === 'disabled'
            ? all.filter((x) => x.status === status)
            : all;
        return res.json({ ok: true, data: filtered });
    }
    function getMyCouponDetail(req, res) {
        const userId = req.user?.id;
        const id = Number(req.params.id);
        if (!Number.isFinite(id))
            return res.status(400).json({ ok: false, message: 'Invalid coupon id' });
        const row = db
            .prepare(`SELECT
          uc.id as userCouponId, uc.couponId, uc.status as ucStatus, uc.assignedAt, uc.usedAt,
          c.name, c.type, c.value, c.base, c.status as cStatus, c.startTime, c.endTime
        FROM user_coupons uc
        INNER JOIN coupons c ON c.id = uc.couponId
        WHERE uc.userId = ? AND uc.id = ?`)
            .get(userId, id);
        if (!row)
            return res.status(404).json({ ok: false, message: 'Coupon not found' });
        const detail = mapUserCoupon(row);
        return res.json({ ok: true, data: { detail, storeInfoList: [] } });
    }
    function adminListCoupons(req, res) {
        const rows = db
            .prepare(`SELECT id, name, type, value, base, status, startTime, endTime, totalCount, issuedCount, createdAt, updatedAt
         FROM coupons
         ORDER BY id DESC`)
            .all();
        return res.json({ ok: true, data: rows });
    }
    function adminCreateCoupon(req, res) {
        const schema = z.object({
            name: z.string().min(1).max(64),
            type: z.union([z.literal(1), z.literal(2)]),
            value: z.number().int().positive(),
            base: z.number().int().nonnegative().optional(),
            startTime: z.number().int().positive(),
            endTime: z.number().int().positive(),
            totalCount: z.number().int().positive().optional(),
            status: z.enum(['enabled', 'disabled']).optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid coupon body', issues: parsed.error.issues });
        const d = parsed.data;
        if (d.endTime <= d.startTime)
            return res.status(400).json({ ok: false, message: 'endTime must be greater than startTime' });
        const info = db
            .prepare(`INSERT INTO coupons (name, type, value, base, status, startTime, endTime, totalCount, issuedCount, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'), datetime('now'))`)
            .run(d.name.trim(), d.type, d.value, d.base ?? 0, d.status ?? 'enabled', d.startTime, d.endTime, d.totalCount ?? 999999);
        const created = db
            .prepare(`SELECT id, name, type, value, base, status, startTime, endTime, totalCount, issuedCount FROM coupons WHERE id = ?`)
            .get(info.lastInsertRowid);
        return res.json({ ok: true, data: created });
    }
    function adminGrantCoupon(req, res) {
        const couponId = Number(req.params.id);
        if (!Number.isFinite(couponId))
            return res.status(400).json({ ok: false, message: 'Invalid coupon id' });
        const schema = z.object({
            userIds: z.array(z.number().int().positive()).optional(),
            grantAllUsers: z.boolean().optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid grant body', issues: parsed.error.issues });
        const coupon = db.prepare(`SELECT * FROM coupons WHERE id = ?`).get(couponId);
        if (!coupon)
            return res.status(404).json({ ok: false, message: 'Coupon not found' });
        if (coupon.status !== 'enabled')
            return res.status(409).json({ ok: false, message: 'Coupon is disabled' });
        const userIds = parsed.data.grantAllUsers || !parsed.data.userIds?.length
            ? db.prepare(`SELECT id FROM users`).all().map((u) => u.id)
            : parsed.data.userIds;
        if (!userIds.length)
            return res.json({ ok: true, data: { grantedCount: 0 } });
        const available = Math.max(0, Number(coupon.totalCount || 0) - Number(coupon.issuedCount || 0));
        if (available <= 0)
            return res.status(409).json({ ok: false, message: 'Coupon stock exhausted' });
        let granted = 0;
        const insert = db.prepare(`INSERT INTO user_coupons (userId, couponId, status, assignedAt, createdAt, updatedAt)
       VALUES (?, ?, 'default', datetime('now'), datetime('now'), datetime('now'))`);
        const updateIssued = db.prepare(`UPDATE coupons SET issuedCount = issuedCount + ?, updatedAt = datetime('now') WHERE id = ?`);
        const tx = db.transaction(() => {
            for (const uid of userIds) {
                if (granted >= available)
                    break;
                insert.run(uid, couponId);
                granted += 1;
            }
            if (granted > 0)
                updateIssued.run(granted, couponId);
        });
        tx();
        return res.json({ ok: true, data: { grantedCount: granted, requestedUsers: userIds.length } });
    }
    function adminUpdateCoupon(req, res) {
        const couponId = Number(req.params.id);
        if (!Number.isFinite(couponId))
            return res.status(400).json({ ok: false, message: 'Invalid coupon id' });
        const schema = z.object({
            name: z.string().min(1).max(64).optional(),
            type: z.union([z.literal(1), z.literal(2)]).optional(),
            value: z.number().int().positive().optional(),
            base: z.number().int().nonnegative().optional(),
            startTime: z.number().int().positive().optional(),
            endTime: z.number().int().positive().optional(),
            totalCount: z.number().int().positive().optional(),
            status: z.enum(['enabled', 'disabled']).optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid coupon body', issues: parsed.error.issues });
        const existing = db.prepare(`SELECT * FROM coupons WHERE id = ?`).get(couponId);
        if (!existing)
            return res.status(404).json({ ok: false, message: 'Coupon not found' });
        const next = {
            name: parsed.data.name?.trim() ?? existing.name,
            type: parsed.data.type ?? existing.type,
            value: parsed.data.value ?? existing.value,
            base: parsed.data.base ?? existing.base,
            startTime: parsed.data.startTime ?? existing.startTime,
            endTime: parsed.data.endTime ?? existing.endTime,
            totalCount: parsed.data.totalCount ?? existing.totalCount,
            status: parsed.data.status ?? existing.status,
        };
        if (next.endTime <= next.startTime) {
            return res.status(400).json({ ok: false, message: 'endTime must be greater than startTime' });
        }
        if (next.totalCount < Number(existing.issuedCount || 0)) {
            return res.status(400).json({ ok: false, message: 'totalCount cannot be less than issuedCount' });
        }
        db.prepare(`UPDATE coupons
       SET name = ?, type = ?, value = ?, base = ?, status = ?, startTime = ?, endTime = ?, totalCount = ?, updatedAt = datetime('now')
       WHERE id = ?`).run(next.name, next.type, next.value, next.base, next.status, next.startTime, next.endTime, next.totalCount, couponId);
        const updated = db
            .prepare(`SELECT id, name, type, value, base, status, startTime, endTime, totalCount, issuedCount FROM coupons WHERE id = ?`)
            .get(couponId);
        return res.json({ ok: true, data: updated });
    }
    function adminDeleteCoupon(req, res) {
        const couponId = Number(req.params.id);
        if (!Number.isFinite(couponId))
            return res.status(400).json({ ok: false, message: 'Invalid coupon id' });
        const existing = db.prepare(`SELECT id FROM coupons WHERE id = ?`).get(couponId);
        if (!existing)
            return res.status(404).json({ ok: false, message: 'Coupon not found' });
        const tx = db.transaction(() => {
            db.prepare(`DELETE FROM user_coupons WHERE couponId = ?`).run(couponId);
            db.prepare(`DELETE FROM coupons WHERE id = ?`).run(couponId);
        });
        tx();
        return res.json({ ok: true, data: { ok: true } });
    }
    return {
        listMyCoupons,
        getMyCouponDetail,
        adminListCoupons,
        adminCreateCoupon,
        adminGrantCoupon,
        adminUpdateCoupon,
        adminDeleteCoupon,
    };
}
