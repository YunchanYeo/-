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
    `id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, categoryId, unit, status, createdAt, updatedAt`;

  function publicProducts(req: Request, res: Response) {
    const { category: categoryRaw, categoryId: categoryIdRaw } = (req.query || {}) as any;
    const categoryId = categoryIdRaw != null && categoryIdRaw !== '' ? Number(categoryIdRaw) : null;
    if (Number.isFinite(categoryId)) {
      const rows = db
        .prepare(
          `SELECT ${productColumns}
           FROM products
           WHERE status = ? AND categoryId IS NOT NULL AND categoryId = ?
           ORDER BY id DESC`,
        )
        .all('ON', Number(categoryId));
      res.json({ ok: true, data: rows });
      return;
    }
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

  /** 商品详情页评价列表与统计（公开） */
  function publicProductReviews(req: Request, res: Response) {
    const productId = Number(req.params.id);
    if (!Number.isFinite(productId) || productId <= 0) {
      return res.status(400).json({ ok: false, message: 'Invalid product id' });
    }
    const exists = db.prepare(`SELECT id FROM products WHERE id = ?`).get(productId);
    if (!exists) return res.status(404).json({ ok: false, message: 'Product not found' });

    const limit = Math.min(100, Math.max(1, Number((req.query as { limit?: string }).limit) || 20));
    const offset = Math.max(0, Number((req.query as { offset?: string }).offset) || 0);

    const statsRow = db
      .prepare(
        `SELECT
           COUNT(*) as commentCount,
           SUM(CASE WHEN score >= 4 THEN 1 ELSE 0 END) as goodCount,
           SUM(CASE WHEN score = 3 THEN 1 ELSE 0 END) as middleCount,
           SUM(CASE WHEN score <= 2 THEN 1 ELSE 0 END) as badCount
         FROM product_reviews WHERE productId = ?`,
      )
      .get(productId) as {
      commentCount: number | null;
      goodCount: number | null;
      middleCount: number | null;
      badCount: number | null;
    };
    const commentCount = Number(statsRow?.commentCount || 0);
    const goodCount = Number(statsRow?.goodCount || 0);
    const middleCount = Number(statsRow?.middleCount || 0);
    const badCount = Number(statsRow?.badCount || 0);
    const goodRate = commentCount > 0 ? Math.floor((goodCount / commentCount) * 1000) / 10 : 0;

    const rows = db
      .prepare(
        `SELECT r.id, r.score, r.content, r.isAnonymous, r.createdAt, r.userId, u.nickName
         FROM product_reviews r
         INNER JOIN users u ON u.id = r.userId
         WHERE r.productId = ?
         ORDER BY r.id DESC
         LIMIT ? OFFSET ?`,
      )
      .all(productId, limit, offset) as Array<{
      id: number;
      score: number;
      content: string;
      isAnonymous: number;
      createdAt: string;
      userId: number;
      nickName: string | null;
    }>;

    const homePageComments = rows.map((x) => ({
      id: x.id,
      spuId: String(productId),
      createdAt: x.createdAt,
      userName: x.isAnonymous ? '匿名用户' : x.nickName || '用户',
      commentScore: x.score,
      commentContent: x.content || '',
      isAnonymity: Boolean(x.isAnonymous),
      userHeadUrl: x.isAnonymous ? '' : `/api/media/user-avatar/${x.userId}`,
    }));

    return res.json({
      ok: true,
      data: {
        homePageComments,
        total: commentCount,
        stats: {
          badCount,
          commentCount,
          goodCount,
          goodRate,
          hasImageCount: 0,
          middleCount,
        },
      },
    });
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
      unit: z.string().optional(),
      soldNum: z.number().int().nonnegative().optional(),
      status: z.enum(['ON', 'OFF']).optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid product body', issues: parsed.error.issues });
    const d = parsed.data;
    const catStr = (d.category ?? '').trim();
    const categoryId = resolveCategoryId(db, catStr);
    const unitStr = (d.unit ?? '').trim() || '件';
    const result = db
      .prepare(
        `INSERT INTO products (title, price, originPrice, stock, image, description, brand, company, category, categoryId, unit, soldNum, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
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
        unitStr,
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
      unit: z.string().optional(),
      status: z.enum(['ON', 'OFF']).optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: 'Invalid product body', issues: parsed.error.issues });
    const exists = db.prepare(`SELECT id, unit FROM products WHERE id = ?`).get(req.params.id) as { id: number; unit: string | null } | undefined;
    if (!exists) return res.status(404).json({ ok: false, message: 'Product not found' });
    const d = parsed.data;
    const body = (req.body || {}) as Record<string, unknown>;
    const catStr = (d.category ?? '').trim();
    const categoryId = resolveCategoryId(db, catStr);
    const unitStr =
      Object.prototype.hasOwnProperty.call(body, 'unit')
        ? String(d.unit ?? '').trim() || '件'
        : String(exists.unit ?? '').trim() || '件';
    db.prepare(
      `UPDATE products
       SET title=?, price=?, originPrice=?, stock=?, image=?, description=?, brand=?, company=?, category=?, categoryId=?, unit=?, status=?,
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
      unitStr,
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

  function adminDeleteProduct(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, message: 'Invalid product id' });
    const result = db.prepare(`DELETE FROM products WHERE id = ?`).run(id);
    if ((result.changes ?? 0) < 1) return res.status(404).json({ ok: false, message: 'Product not found' });
    return res.json({ ok: true, data: { deleted: true } });
  }

  return {
    publicProducts,
    publicProductDetail,
    publicProductReviews,
    adminProducts,
    adminProductDetail,
    adminCreateProduct,
    adminUpdateProduct,
    adminUpdateProductStock,
    adminDeleteProduct,
  };
}
