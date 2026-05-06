import { z } from 'zod';
import type { Request, Response } from 'express';
import type { Db } from '../types';
import { nameVariantsForCategoryFilter } from '../categoryLegacy';

function resolveCategoryId(db: Db, categoryName: string | null | undefined): number | null {
  const n = String(categoryName ?? '').trim();
  if (!n) return null;
  const row = db.prepare(`SELECT id FROM product_categories WHERE TRIM(name) = ? LIMIT 1`).get(n) as { id: number } | undefined;
  return row?.id ?? null;
}

export function createProductService({ db }: { db: Db }) {
  const productColumns =
    `id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, categoryId, status, createdAt, updatedAt`;

  function publicProducts(req: Request, res: Response) {
    const { category: categoryRaw } = (req.query || {}) as any;
    const category = categoryRaw != null && categoryRaw !== '' ? String(categoryRaw).trim() : '';
    if (category) {
      const cid = resolveCategoryId(db, category);
      const variants = nameVariantsForCategoryFilter(category);
      const inList = variants.length ? variants : [category];
      const placeholders = inList.map(() => '?').join(', ');
      const rows = cid
        ? db
            .prepare(
              `SELECT ${productColumns}
               FROM products WHERE status = ? AND (
                 (categoryId IS NOT NULL AND categoryId = ?)
                 OR TRIM(COALESCE(category,'')) IN (${placeholders})
               ) ORDER BY id DESC`,
            )
            .all('ON', cid, ...inList)
        : db
            .prepare(
              `SELECT ${productColumns}
               FROM products WHERE status = ? AND TRIM(COALESCE(category,'')) IN (${placeholders}) ORDER BY id DESC`,
            )
            .all('ON', ...inList);
      res.json({ ok: true, data: rows });
      return;
    }
    const rows = db
      .prepare(`SELECT ${productColumns} FROM products WHERE status = ? ORDER BY id DESC`)
      .all('ON');
    res.json({ ok: true, data: rows });
  }

  function publicProductDetail(req: Request, res: Response) {
    const row = db.prepare(`SELECT ${productColumns} FROM products WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ ok: false, message: 'Product not found' });
    res.json({ ok: true, data: row });
  }

  function adminProducts(req: Request, res: Response) {
    const rows = db.prepare(`SELECT ${productColumns} FROM products ORDER BY id DESC`).all();
    return res.json({ ok: true, data: rows });
  }

  function adminProductDetail(req: Request, res: Response) {
    const row = db.prepare(`SELECT ${productColumns} FROM products WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ ok: false, message: 'Product not found' });
    return res.json({ ok: true, data: row });
  }

  function adminCreateProduct(req: Request, res: Response) {
    const schema = z.object({
      title: z.string().min(1),
      price: z.number().int().nonnegative(),
      originPrice: z.number().int().nonnegative().optional(),
      stock: z.number().int().nonnegative(),
      image: z.string().optional(),
      description: z.string().optional(),
      brand: z.string().optional(),
      company: z.string().optional(),
      category: z.string().optional(),
      soldNum: z.number().int().nonnegative().optional(),
      status: z.enum(['ON', 'OFF']).optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid product body', issues: parsed.error.issues });
    const d = parsed.data;
    const catStr = (d.category ?? '').trim();
    const categoryId = resolveCategoryId(db, catStr);
    const result = db
      .prepare(
        `INSERT INTO products (title, price, originPrice, stock, image, description, brand, company, category, categoryId, soldNum, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      )
      .run(
        d.title,
        d.price,
        d.originPrice ?? null,
        d.stock,
        d.image ?? '',
        d.description ?? '',
        d.brand ?? '',
        d.company ?? '',
        catStr,
        categoryId,
        d.soldNum ?? 0,
        d.status ?? 'ON',
      );
    const created = db.prepare(`SELECT ${productColumns} FROM products WHERE id = ?`).get(result.lastInsertRowid);
    return res.json({ ok: true, data: created });
  }

  function adminUpdateProduct(req: Request, res: Response) {
    const schema = z.object({
      title: z.string().min(1),
      price: z.number().int().nonnegative(),
      originPrice: z.number().int().nonnegative().nullable().optional(),
      stock: z.number().int().nonnegative(),
      image: z.string().optional(),
      description: z.string().optional(),
      brand: z.string().optional(),
      company: z.string().optional(),
      category: z.string().optional(),
      status: z.enum(['ON', 'OFF']).optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid product body', issues: parsed.error.issues });
    const exists = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.id) as { id: number } | undefined;
    if (!exists) return res.status(404).json({ ok: false, message: 'Product not found' });
    const d = parsed.data;
    const catStr = (d.category ?? '').trim();
    const categoryId = resolveCategoryId(db, catStr);
    db.prepare(
      `UPDATE products
       SET title=?, price=?, originPrice=?, stock=?, image=?, description=?, brand=?, company=?, category=?, categoryId=?, status=?,
           updatedAt=datetime('now')
       WHERE id=?`,
    ).run(
      d.title,
      d.price,
      d.originPrice === undefined ? null : d.originPrice,
      d.stock,
      d.image ?? '',
      d.description ?? '',
      d.brand ?? '',
      d.company ?? '',
      catStr,
      categoryId,
      d.status ?? 'ON',
      req.params.id,
    );
    const updated = db.prepare(`SELECT ${productColumns} FROM products WHERE id = ?`).get(req.params.id);
    return res.json({ ok: true, data: updated });
  }

  function adminUpdateProductStock(req: Request, res: Response) {
    const schema = z.object({ stock: z.number().int().nonnegative() });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid stock body', issues: parsed.error.issues });
    const exists = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.id) as { id: number } | undefined;
    if (!exists) return res.status(404).json({ ok: false, message: 'Product not found' });
    db.prepare(`UPDATE products SET stock = ?, updatedAt = datetime('now') WHERE id = ?`).run(parsed.data.stock, req.params.id);
    const updated = db.prepare(`SELECT ${productColumns} FROM products WHERE id = ?`).get(req.params.id);
    return res.json({ ok: true, data: updated });
  }

  return {
    publicProducts,
    publicProductDetail,
    adminProducts,
    adminProductDetail,
    adminCreateProduct,
    adminUpdateProduct,
    adminUpdateProductStock,
  };
}
