import type { Db } from '../types';

/** 下单行里没有图时尝试用商品的 id(spuId) 从 products 表补 primaryImage/thumb/image，避免详情/列表缩略图为空 */
function extractProductIdFromOrderItem(item: Record<string, unknown>): number | null {
  const raw = item.spuId ?? item.productId ?? item.spu_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const legacy = /^spu_(\d+)$/i.exec(s);
  if (legacy?.[1]) {
    const n = parseInt(legacy[1], 10);
    return Number.isFinite(n) ? n : null;
  }
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function existingImageSrc(item: Record<string, unknown>): string {
  for (const k of ['primaryImage', 'thumb', 'image', 'pic', 'picture'] as const) {
    const v = item[k];
    if (v != null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

export function hydrateOrderItemsWithProduct(db: Db, items: unknown[]): Record<string, unknown>[] {
  if (!Array.isArray(items)) return [];
  const stmt = db.prepare(`SELECT id, title, image FROM products WHERE id = ?`);
  return items.map((raw) => {
    const item = raw as Record<string, unknown>;
    const pid = extractProductIdFromOrderItem(item);
    if (existingImageSrc(item) !== '' || pid == null) return { ...item };
    const row = stmt.get(pid) as { title: string; image: string | null } | undefined;
    if (!row?.image) return { ...item };
    const next = { ...item };
    next.primaryImage = row.image;
    next.image = row.image;
    next.thumb = row.image;
    if (!next.goodsName || String(next.goodsName).trim() === '') next.goodsName = row.title;
    if (!next.title || String(next.title).trim() === '') next.title = row.title;
    return next;
  });
}
