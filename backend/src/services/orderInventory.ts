import type { Db } from '../types';
import { extractProductIdFromOrderItem } from './orderItemImages';

function aggregateQtyByProductId(items: unknown[]): Map<number, number> {
  const m = new Map<number, number>();
  if (!Array.isArray(items)) return m;
  for (const raw of items) {
    const item = raw as Record<string, unknown>;
    const pid = extractProductIdFromOrderItem(item);
    if (pid == null) continue;
    const qty = Math.max(0, Math.floor(Number(item.quantity ?? item.buyQuantity ?? 1) || 0));
    if (qty <= 0) continue;
    m.set(pid, (m.get(pid) || 0) + qty);
  }
  return m;
}

/** 支付成功：按订单行扣减库存、增加 soldNum（幂等由调用方保证仅对待付款订单执行一次） */
export function applyStockDecrementForOrderItems(db: Db, itemsJson: string) {
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(itemsJson || '[]');
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  const agg = aggregateQtyByProductId(items);
  const stmt = db.prepare(
    `UPDATE products
     SET stock = stock - ?,
         soldNum = soldNum + ?,
         updatedAt = datetime('now')
     WHERE id = ? AND stock >= ?`,
  );
  for (const [id, qty] of agg) {
    const r = stmt.run(qty, qty, id, qty);
    if ((r.changes ?? 0) !== 1) {
      throw new Error(`商品 ID ${id} 库存不足，无法完成支付`);
    }
  }
}

/** 退款：按订单行退回库存、减少 soldNum */
export function restoreStockForOrderItems(db: Db, itemsJson: string) {
  let items: unknown[] = [];
  try {
    const parsed = JSON.parse(itemsJson || '[]');
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  const agg = aggregateQtyByProductId(items);
  const stmt = db.prepare(
    `UPDATE products
     SET stock = stock + ?,
         soldNum = CASE WHEN soldNum >= ? THEN soldNum - ? ELSE 0 END,
         updatedAt = datetime('now')
     WHERE id = ?`,
  );
  for (const [id, qty] of agg) {
    stmt.run(qty, qty, qty, id);
  }
}
