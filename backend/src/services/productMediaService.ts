import type { Request, Response } from 'express';
import type { Db } from '../types';

/** 관리자 상품 이미지 BLOB (SQLite product_media) 공개 조회 */
export function createProductMediaService({ db }: { db: Db }) {
  function serveProductImage(req: Request, res: Response) {
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id < 1) {
      res.status(400).end();
      return;
    }
    const row = db
      .prepare(`SELECT mimeType, data FROM product_media WHERE id = ?`)
      .get(id) as { mimeType: string; data: Buffer } | undefined;
    if (!row || !row.data) {
      res.status(404).end();
      return;
    }
    const mime = String(row.mimeType || 'image/jpeg').trim() || 'image/jpeg';
    res.setHeader('Content-Type', mime);
    res.setHeader('Cache-Control', 'public, max-age=604800');
    res.send(row.data);
  }

  return { serveProductImage };
}
