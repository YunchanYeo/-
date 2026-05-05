import { z } from 'zod';
export function createProductService({ db }) {
    function publicProducts(req, res) {
        const { category } = (req.query || {});
        const rows = category
            ? db
                .prepare(`SELECT id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, status, createdAt, updatedAt
             FROM products WHERE status = ? AND category = ? ORDER BY id DESC`)
                .all('ON', String(category))
            : db
                .prepare(`SELECT id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, status, createdAt, updatedAt
             FROM products WHERE status = ? ORDER BY id DESC`)
                .all('ON');
        res.json({ ok: true, data: rows });
    }
    function publicProductDetail(req, res) {
        const row = db
            .prepare(`SELECT id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, status, createdAt, updatedAt
         FROM products WHERE id = ?`)
            .get(req.params.id);
        if (!row)
            return res.status(404).json({ ok: false, message: 'Product not found' });
        res.json({ ok: true, data: row });
    }
    function adminProducts(req, res) {
        const rows = db
            .prepare(`SELECT id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, status, createdAt, updatedAt
         FROM products ORDER BY id DESC`)
            .all();
        return res.json({ ok: true, data: rows });
    }
    function adminProductDetail(req, res) {
        const row = db
            .prepare(`SELECT id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, status, createdAt, updatedAt
         FROM products WHERE id = ?`)
            .get(req.params.id);
        if (!row)
            return res.status(404).json({ ok: false, message: 'Product not found' });
        return res.json({ ok: true, data: row });
    }
    function adminCreateProduct(req, res) {
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
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid product body', issues: parsed.error.issues });
        const d = parsed.data;
        const result = db
            .prepare(`INSERT INTO products (title, price, originPrice, stock, image, description, brand, company, category, soldNum, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
            .run(d.title, d.price, d.originPrice ?? null, d.stock, d.image ?? '', d.description ?? '', d.brand ?? '', d.company ?? '', d.category ?? '', d.soldNum ?? 0, d.status ?? 'ON');
        const created = db
            .prepare(`SELECT id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, status, createdAt, updatedAt
         FROM products WHERE id = ?`)
            .get(result.lastInsertRowid);
        return res.json({ ok: true, data: created });
    }
    function adminUpdateProduct(req, res) {
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
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid product body', issues: parsed.error.issues });
        const exists = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.id);
        if (!exists)
            return res.status(404).json({ ok: false, message: 'Product not found' });
        const d = parsed.data;
        db.prepare(`UPDATE products
       SET title=?, price=?, originPrice=?, stock=?, image=?, description=?, brand=?, company=?, category=?, status=?,
           updatedAt=datetime('now')
       WHERE id=?`).run(d.title, d.price, d.originPrice === undefined ? null : d.originPrice, d.stock, d.image ?? '', d.description ?? '', d.brand ?? '', d.company ?? '', d.category ?? '', d.status ?? 'ON', req.params.id);
        const updated = db
            .prepare(`SELECT id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, status, createdAt, updatedAt
         FROM products WHERE id = ?`)
            .get(req.params.id);
        return res.json({ ok: true, data: updated });
    }
    function adminUpdateProductStock(req, res) {
        const schema = z.object({ stock: z.number().int().nonnegative() });
        const parsed = schema.safeParse(req.body || {});
        if (!parsed.success)
            return res.status(400).json({ ok: false, message: 'Invalid stock body', issues: parsed.error.issues });
        const exists = db.prepare(`SELECT id FROM products WHERE id = ?`).get(req.params.id);
        if (!exists)
            return res.status(404).json({ ok: false, message: 'Product not found' });
        db.prepare(`UPDATE products SET stock = ?, updatedAt = datetime('now') WHERE id = ?`).run(parsed.data.stock, req.params.id);
        const updated = db
            .prepare(`SELECT id, title, price, originPrice, stock, image, description, brand, company, soldNum, category, status, createdAt, updatedAt
         FROM products WHERE id = ?`)
            .get(req.params.id);
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
