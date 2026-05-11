import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Db } from '../types';

const promotionWriteSchema = z.object({
  title: z.string().min(1),
  imageUrl: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['ON', 'OFF']).optional(),
  sortOrder: z.number().int().optional(),
  relatedProductId: z.number().int().positive().nullable().optional(),
});

export function createPromotionService({ db }: { db: Db }) {
  function publicPromotions(req: Request, res: Response) {
    const rows = db
      .prepare(
        `SELECT id, title, imageUrl, description, status, sortOrder, relatedProductId, createdAt, updatedAt
         FROM promotions
         WHERE status = 'ON'
         ORDER BY sortOrder DESC, id DESC`,
      )
      .all();
    return res.json({ ok: true, data: rows });
  }

  function publicPromotionDetail(req: Request, res: Response) {
    const row = db
      .prepare(
        `SELECT id, title, imageUrl, description, status, sortOrder, relatedProductId, createdAt, updatedAt
         FROM promotions
         WHERE id = ? AND status = 'ON'`,
      )
      .get(req.params.id) as any;
    if (!row) return res.status(404).json({ ok: false, message: 'Promotion not found' });
    let relatedProduct: any = null;
    if (row.relatedProductId) {
      relatedProduct = db
        .prepare(
          `SELECT id, title, price, originPrice, stock, image, category, soldNum
           FROM products
           WHERE id = ? AND status = 'ON'`,
        )
        .get(row.relatedProductId);
    }
    return res.json({ ok: true, data: { ...row, relatedProduct } });
  }

  function adminPromotions(req: Request, res: Response) {
    const rows = db
      .prepare(
        `SELECT id, title, imageUrl, description, status, sortOrder, relatedProductId, createdAt, updatedAt
         FROM promotions
         ORDER BY sortOrder DESC, id DESC`,
      )
      .all();
    return res.json({ ok: true, data: rows });
  }

  function adminCreatePromotion(req: Request, res: Response) {
    const parsed = promotionWriteSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid promotion body', issues: parsed.error.issues });
    const d = parsed.data;
    const result = db
      .prepare(
        `INSERT INTO promotions (title, imageUrl, description, status, sortOrder, relatedProductId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(
        d.title.trim(),
        d.imageUrl.trim(),
        String(d.description || ''),
        d.status || 'ON',
        Number.isFinite(d.sortOrder) ? Number(d.sortOrder) : 0,
        d.relatedProductId ?? null,
      );
    const created = db
      .prepare(
        `SELECT id, title, imageUrl, description, status, sortOrder, relatedProductId, createdAt, updatedAt
         FROM promotions WHERE id = ?`,
      )
      .get(result.lastInsertRowid);
    return res.json({ ok: true, data: created });
  }

  function adminUpdatePromotion(req: Request, res: Response) {
    const parsed = promotionWriteSchema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid promotion body', issues: parsed.error.issues });
    const d = parsed.data;
    const exists = db.prepare(`SELECT id FROM promotions WHERE id = ?`).get(req.params.id);
    if (!exists) return res.status(404).json({ ok: false, message: 'Promotion not found' });
    db.prepare(
      `UPDATE promotions
       SET title = ?, imageUrl = ?, description = ?, status = ?, sortOrder = ?, relatedProductId = ?, updatedAt = datetime('now')
       WHERE id = ?`,
    ).run(
      d.title.trim(),
      d.imageUrl.trim(),
      String(d.description || ''),
      d.status || 'ON',
      Number.isFinite(d.sortOrder) ? Number(d.sortOrder) : 0,
      d.relatedProductId ?? null,
      req.params.id,
    );
    const updated = db
      .prepare(
        `SELECT id, title, imageUrl, description, status, sortOrder, relatedProductId, createdAt, updatedAt
         FROM promotions WHERE id = ?`,
      )
      .get(req.params.id);
    return res.json({ ok: true, data: updated });
  }

  function adminDeletePromotion(req: Request, res: Response) {
    const exists = db.prepare(`SELECT id FROM promotions WHERE id = ?`).get(req.params.id);
    if (!exists) return res.status(404).json({ ok: false, message: 'Promotion not found' });
    db.prepare(`DELETE FROM promotions WHERE id = ?`).run(req.params.id);
    return res.json({ ok: true, data: { id: Number(req.params.id) } });
  }

  return {
    publicPromotions,
    publicPromotionDetail,
    adminPromotions,
    adminCreatePromotion,
    adminUpdatePromotion,
    adminDeletePromotion,
  };
}

