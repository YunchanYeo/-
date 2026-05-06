import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Db } from '../types';

const DEFAULT_THUMB_BY_NAME: Record<string, string> = {
  面: 'https://img.icons8.com/color/240/noodles.png',
  零食: 'https://img.icons8.com/color/240/potato-chips.png',
  饮料: 'https://img.icons8.com/color/240/water-bottle.png',
  饭: 'https://img.icons8.com/color/240/rice-bowl.png',
  罐头: 'https://img.icons8.com/color/240/tin-can.png',
};
const FALLBACK_THUMB = 'https://img.icons8.com/color/240/shopping-basket-2.png';

function resolveThumbnail(name: string, stored: string | null | undefined) {
  const s = stored?.trim();
  if (s) return s;
  return DEFAULT_THUMB_BY_NAME[name] || FALLBACK_THUMB;
}

export function createCategoryService({ db }: { db: Db }) {
  /** 客户端与管理员共用：扁平列表，新增分类后立即出现在小程序分类页 */
  function categories(_req: Request, res: Response) {
    const rows = db
      .prepare(`SELECT id, name, sortOrder, thumbnail, createdAt FROM product_categories ORDER BY sortOrder ASC, id ASC`)
      .all() as Array<{ id: number; name: string; sortOrder: number; thumbnail: string | null; createdAt: string }>;
    const data = rows.map((row) => ({
      ...row,
      thumb: resolveThumbnail(row.name, row.thumbnail),
    }));
    res.json({ ok: true, data });
  }

  function adminListCategories(_req: Request, res: Response) {
    const rows = db
      .prepare(`SELECT id, name, sortOrder, thumbnail, createdAt FROM product_categories ORDER BY sortOrder ASC, id ASC`)
      .all();
    res.json({ ok: true, data: rows });
  }

  function adminCreateCategory(req: Request, res: Response) {
    const schema = z.object({
      name: z.string().min(1).max(32),
      thumbnail: z.string().optional(),
      sortOrder: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: '无效的分类数据', issues: parsed.error.issues });
    const maxRow = db.prepare(`SELECT COALESCE(MAX(sortOrder), -1) as m FROM product_categories`).get() as { m: number };
    const sortOrder = parsed.data.sortOrder ?? maxRow.m + 1;
    try {
      const info = db.prepare(`INSERT INTO product_categories (name, sortOrder, thumbnail) VALUES (?, ?, ?)`).run(
        parsed.data.name.trim(),
        sortOrder,
        parsed.data.thumbnail?.trim() || null,
      );
      const row = db
        .prepare(`SELECT id, name, sortOrder, thumbnail, createdAt FROM product_categories WHERE id = ?`)
        .get(Number(info.lastInsertRowid));
      return res.json({ ok: true, data: row });
    } catch (e: any) {
      if (String(e?.message || '').includes('UNIQUE')) {
        return res.status(409).json({ ok: false, message: '分类名称已存在' });
      }
      throw e;
    }
  }

  function adminUpdateCategory(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, message: '无效的分类 ID' });
    const schema = z.object({
      name: z.string().min(1).max(32).optional(),
      thumbnail: z.union([z.string(), z.null()]).optional(),
      sortOrder: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body || {});
    if (!parsed.success) return res.status(400).json({ ok: false, message: '无效的分类数据', issues: parsed.error.issues });

    const existing = db
      .prepare(`SELECT id, name, thumbnail, sortOrder FROM product_categories WHERE id = ?`)
      .get(id) as { id: number; name: string; thumbnail: string | null; sortOrder: number } | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: '分类不存在' });

    const nextName = parsed.data.name !== undefined ? parsed.data.name.trim() : existing.name;
    const nextThumb =
      parsed.data.thumbnail !== undefined
        ? parsed.data.thumbnail === null || parsed.data.thumbnail === ''
          ? null
          : String(parsed.data.thumbnail).trim() || null
        : existing.thumbnail;
    const nextSort = parsed.data.sortOrder !== undefined ? parsed.data.sortOrder : existing.sortOrder;

    if (nextName !== existing.name) {
      const clash = db.prepare(`SELECT id FROM product_categories WHERE name = ? AND id != ?`).get(nextName, id);
      if (clash) return res.status(409).json({ ok: false, message: '分类名称已存在' });
      db.prepare(`UPDATE products SET category = ?, updatedAt = datetime('now') WHERE category = ? OR categoryId = ?`).run(
        nextName,
        existing.name,
        id,
      );
    }

    db.prepare(`UPDATE product_categories SET name = ?, thumbnail = ?, sortOrder = ? WHERE id = ?`).run(nextName, nextThumb, nextSort, id);
    const row = db.prepare(`SELECT id, name, sortOrder, thumbnail, createdAt FROM product_categories WHERE id = ?`).get(id);
    return res.json({ ok: true, data: row });
  }

  function adminDeleteCategory(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ ok: false, message: '无效的分类 ID' });
    const existing = db.prepare(`SELECT id, name FROM product_categories WHERE id = ?`).get(id) as { id: number; name: string } | undefined;
    if (!existing) return res.status(404).json({ ok: false, message: '分类不存在' });
    const cnt = (
      db
        .prepare(`SELECT COUNT(*) as c FROM products WHERE category = ? OR categoryId = ?`)
        .get(existing.name, existing.id) as { c: number }
    ).c;
    if (cnt > 0) return res.status(409).json({ ok: false, message: `该分类下还有 ${cnt} 个商品，无法删除` });
    db.prepare(`DELETE FROM product_categories WHERE id = ?`).run(id);
    return res.json({ ok: true, data: { ok: true } });
  }

  return { categories, adminListCategories, adminCreateCategory, adminUpdateCategory, adminDeleteCategory };
}
