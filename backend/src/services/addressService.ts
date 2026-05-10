import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Db } from '../types';

/** wx / 表单可能传入字符串或 null；SQLite REAL 也可能读出非 number */
const optionalCoord = z.preprocess((v) => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}, z.number().optional());

/** 小程序 t-input number 等会把 phone 打成数字；null 字段也需收紧 */
function normalizeAddressBody(body: unknown): Record<string, unknown> {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  const s = (v: unknown) => (v === null || v === undefined ? '' : String(v));
  return {
    name: s(b.name).trim(),
    phone: s(b.phone).replace(/\s/g, ''),
    countryName: s(b.countryName),
    countryCode: s(b.countryCode),
    provinceName: s(b.provinceName),
    provinceCode: s(b.provinceCode),
    cityName: s(b.cityName),
    cityCode: s(b.cityCode),
    districtName: s(b.districtName),
    districtCode: s(b.districtCode),
    detailAddress: s(b.detailAddress),
    addressTag: s(b.addressTag),
    isDefault: b.isDefault,
    latitude: b.latitude,
    longitude: b.longitude,
  };
}

const addressWriteSchema = z.object({
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
  latitude: optionalCoord,
  longitude: optionalCoord,
});

export function createAddressService({ db }: { db: Db }) {
  function listAddresses(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const rows = db
      .prepare(
        `SELECT id, name, phone, countryName, countryCode, provinceName, provinceCode, cityName, cityCode,
                districtName, districtCode, detailAddress, addressTag, isDefault, latitude, longitude
         FROM user_addresses
         WHERE userId = ?
         ORDER BY isDefault DESC, id DESC`,
      )
      .all(userId);
    return res.json({ ok: true, data: rows });
  }

  function getAddress(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const row = db
      .prepare(
        `SELECT id, name, phone, countryName, countryCode, provinceName, provinceCode, cityName, cityCode,
                districtName, districtCode, detailAddress, addressTag, isDefault, latitude, longitude
         FROM user_addresses
         WHERE id = ? AND userId = ?`,
      )
      .get(req.params.id, userId);
    if (!row) return res.status(404).json({ ok: false, message: 'Address not found' });
    return res.json({ ok: true, data: row });
  }

  function createAddress(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const parsed = addressWriteSchema.safeParse(normalizeAddressBody(req.body));
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid address body', issues: parsed.error.issues });
    const d = parsed.data;
    const isDefault = d.isDefault === true || d.isDefault === 1 ? 1 : 0;
    if (isDefault) db.prepare(`UPDATE user_addresses SET isDefault = 0, updatedAt = datetime('now') WHERE userId = ?`).run(userId);
    const result = db
      .prepare(
        `INSERT INTO user_addresses (
          userId, name, phone, countryName, countryCode, provinceName, provinceCode, cityName, cityCode,
          districtName, districtCode, detailAddress, addressTag, isDefault, latitude, longitude, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(
        userId,
        d.name,
        d.phone,
        d.countryName ?? '',
        d.countryCode ?? '',
        d.provinceName ?? '',
        d.provinceCode ?? '',
        d.cityName ?? '',
        d.cityCode ?? '',
        d.districtName ?? '',
        d.districtCode ?? '',
        d.detailAddress ?? '',
        d.addressTag ?? '',
        isDefault,
        d.latitude ?? null,
        d.longitude ?? null,
      );
    const created = db.prepare(`SELECT * FROM user_addresses WHERE id = ?`).get(result.lastInsertRowid);
    return res.json({ ok: true, data: created });
  }

  function updateAddress(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const parsed = addressWriteSchema.safeParse(normalizeAddressBody(req.body));
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid address body', issues: parsed.error.issues });
    const exists = db.prepare(`SELECT id FROM user_addresses WHERE id = ? AND userId = ?`).get(req.params.id, userId);
    if (!exists) return res.status(404).json({ ok: false, message: 'Address not found' });
    const d = parsed.data;
    const isDefault = d.isDefault === true || d.isDefault === 1 ? 1 : 0;
    if (isDefault) db.prepare(`UPDATE user_addresses SET isDefault = 0, updatedAt = datetime('now') WHERE userId = ?`).run(userId);
    db.prepare(
      `UPDATE user_addresses
       SET name=?, phone=?, countryName=?, countryCode=?, provinceName=?, provinceCode=?, cityName=?, cityCode=?,
           districtName=?, districtCode=?, detailAddress=?, addressTag=?, isDefault=?, latitude=?, longitude=?,
           updatedAt=datetime('now')
       WHERE id=? AND userId=?`,
    ).run(
      d.name,
      d.phone,
      d.countryName ?? '',
      d.countryCode ?? '',
      d.provinceName ?? '',
      d.provinceCode ?? '',
      d.cityName ?? '',
      d.cityCode ?? '',
      d.districtName ?? '',
      d.districtCode ?? '',
      d.detailAddress ?? '',
      d.addressTag ?? '',
      isDefault,
      d.latitude ?? null,
      d.longitude ?? null,
      req.params.id,
      userId,
    );
    const updated = db.prepare(`SELECT * FROM user_addresses WHERE id = ?`).get(req.params.id);
    return res.json({ ok: true, data: updated });
  }

  function deleteAddress(req: Request, res: Response) {
    const userId = (req as any).user?.id;
    const exists = db.prepare(`SELECT id FROM user_addresses WHERE id = ? AND userId = ?`).get(req.params.id, userId);
    if (!exists) return res.status(404).json({ ok: false, message: 'Address not found' });
    db.prepare(`DELETE FROM user_addresses WHERE id = ? AND userId = ?`).run(req.params.id, userId);
    return res.json({ ok: true, data: { id: Number(req.params.id) } });
  }

  return { listAddresses, getAddress, createAddress, updateAddress, deleteAddress };
}
