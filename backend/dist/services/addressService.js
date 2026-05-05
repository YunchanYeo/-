import { z } from 'zod';
export function createAddressService({ db }) {
    function listAddresses(req, res) {
        const userId = req.user?.id;
        const rows = db
            .prepare(`SELECT id, name, phone, countryName, countryCode, provinceName, provinceCode, cityName, cityCode,
                districtName, districtCode, detailAddress, addressTag, isDefault, latitude, longitude
         FROM user_addresses
         WHERE userId = ?
         ORDER BY isDefault DESC, id DESC`)
            .all(userId);
        return res.json({ ok: true, data: rows });
    }
    function getAddress(req, res) {
        const userId = req.user?.id;
        const row = db
            .prepare(`SELECT id, name, phone, countryName, countryCode, provinceName, provinceCode, cityName, cityCode,
                districtName, districtCode, detailAddress, addressTag, isDefault, latitude, longitude
         FROM user_addresses
         WHERE id = ? AND userId = ?`)
            .get(req.params.id, userId);
        if (!row)
            return res.status(404).json({ ok: false, message: 'Address not found' });
        return res.json({ ok: true, data: row });
    }
    function createAddress(req, res) {
        const userId = req.user?.id;
        const schema = z.object({
            name: z.string().min(1),
            phone: z.string().min(1),
            countryName: z.string().optional(),
            countryCode: z.string().optional(),
            provinceName: z.string().optional(),
            provinceCode: z.string().optional(),
            cityName: z.string().optional(),
            cityCode: z.string().optional(),
            districtName: z.string().optional(),
            districtCode: z.string().optional(),
            detailAddress: z.string().optional(),
            addressTag: z.string().optional(),
            isDefault: z.union([z.boolean(), z.number()]).optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid address body', issues: parsed.error.issues });
        const d = parsed.data;
        const isDefault = d.isDefault === true || d.isDefault === 1 ? 1 : 0;
        if (isDefault)
            db.prepare(`UPDATE user_addresses SET isDefault = 0, updatedAt = datetime('now') WHERE userId = ?`).run(userId);
        const result = db
            .prepare(`INSERT INTO user_addresses (
          userId, name, phone, countryName, countryCode, provinceName, provinceCode, cityName, cityCode,
          districtName, districtCode, detailAddress, addressTag, isDefault, latitude, longitude, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
            .run(userId, d.name, d.phone, d.countryName ?? '', d.countryCode ?? '', d.provinceName ?? '', d.provinceCode ?? '', d.cityName ?? '', d.cityCode ?? '', d.districtName ?? '', d.districtCode ?? '', d.detailAddress ?? '', d.addressTag ?? '', isDefault, d.latitude ?? null, d.longitude ?? null);
        const created = db.prepare(`SELECT * FROM user_addresses WHERE id = ?`).get(result.lastInsertRowid);
        return res.json({ ok: true, data: created });
    }
    function updateAddress(req, res) {
        const userId = req.user?.id;
        const schema = z.object({
            name: z.string().min(1),
            phone: z.string().min(1),
            countryName: z.string().optional(),
            countryCode: z.string().optional(),
            provinceName: z.string().optional(),
            provinceCode: z.string().optional(),
            cityName: z.string().optional(),
            cityCode: z.string().optional(),
            districtName: z.string().optional(),
            districtCode: z.string().optional(),
            detailAddress: z.string().optional(),
            addressTag: z.string().optional(),
            isDefault: z.union([z.boolean(), z.number()]).optional(),
            latitude: z.number().optional(),
            longitude: z.number().optional(),
        });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid address body', issues: parsed.error.issues });
        const exists = db.prepare(`SELECT id FROM user_addresses WHERE id = ? AND userId = ?`).get(req.params.id, userId);
        if (!exists)
            return res.status(404).json({ ok: false, message: 'Address not found' });
        const d = parsed.data;
        const isDefault = d.isDefault === true || d.isDefault === 1 ? 1 : 0;
        if (isDefault)
            db.prepare(`UPDATE user_addresses SET isDefault = 0, updatedAt = datetime('now') WHERE userId = ?`).run(userId);
        db.prepare(`UPDATE user_addresses
       SET name=?, phone=?, countryName=?, countryCode=?, provinceName=?, provinceCode=?, cityName=?, cityCode=?,
           districtName=?, districtCode=?, detailAddress=?, addressTag=?, isDefault=?, latitude=?, longitude=?,
           updatedAt=datetime('now')
       WHERE id=? AND userId=?`).run(d.name, d.phone, d.countryName ?? '', d.countryCode ?? '', d.provinceName ?? '', d.provinceCode ?? '', d.cityName ?? '', d.cityCode ?? '', d.districtName ?? '', d.districtCode ?? '', d.detailAddress ?? '', d.addressTag ?? '', isDefault, d.latitude ?? null, d.longitude ?? null, req.params.id, userId);
        const updated = db.prepare(`SELECT * FROM user_addresses WHERE id = ?`).get(req.params.id);
        return res.json({ ok: true, data: updated });
    }
    function deleteAddress(req, res) {
        const userId = req.user?.id;
        const exists = db.prepare(`SELECT id FROM user_addresses WHERE id = ? AND userId = ?`).get(req.params.id, userId);
        if (!exists)
            return res.status(404).json({ ok: false, message: 'Address not found' });
        db.prepare(`DELETE FROM user_addresses WHERE id = ? AND userId = ?`).run(req.params.id, userId);
        return res.json({ ok: true, data: { id: Number(req.params.id) } });
    }
    return { listAddresses, getAddress, createAddress, updateAddress, deleteAddress };
}
