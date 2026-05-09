import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db';
import { saveMediaFromBuffer } from '../storage/mediaStorage';

function basenameFromUrl(input: string) {
  const s = String(input || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    return path.basename(u.pathname);
  } catch {
    return path.basename(s);
  }
}

async function main() {
  if (String(process.env.MEDIA_PROVIDER || '').trim().toLowerCase() !== 'aliyun-oss') {
    throw new Error('Set MEDIA_PROVIDER=aliyun-oss first');
  }
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadsDir = path.join(__dirname, '..', '..', 'data', 'uploads');
  const db = getDb();

  if (!fs.existsSync(uploadsDir)) {
    throw new Error(`uploads directory not found: ${uploadsDir}`);
  }

  const files = fs.readdirSync(uploadsDir).filter((f) => fs.statSync(path.join(uploadsDir, f)).isFile());
  console.log(`[migrate:oss] found ${files.length} local files`);
  const map = new Map<string, string>();

  for (const name of files) {
    const full = path.join(uploadsDir, name);
    const buf = fs.readFileSync(full);
    const ext = path.extname(name).toLowerCase();
    const isImage = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
    const mimeType = isImage ? 'image/jpeg' : 'audio/mpeg';
    const url = await saveMediaFromBuffer({
      kind: isImage ? 'image' : 'voice',
      mimeType,
      fileName: name,
      buffer: buf,
      uploadsDir,
      objectPrefix: 'uploads',
    });
    map.set(name, url);
  }

  let updatedProducts = 0;
  const products = db.prepare(`SELECT id, image FROM products WHERE image IS NOT NULL AND TRIM(image) != ''`).all() as Array<{ id: number; image: string }>;
  const updProd = db.prepare(`UPDATE products SET image = ?, updatedAt = datetime('now') WHERE id = ?`);
  for (const row of products) {
    const bn = basenameFromUrl(row.image);
    const to = map.get(bn);
    if (!to) continue;
    updProd.run(to, row.id);
    updatedProducts += 1;
  }

  let updatedSupport = 0;
  const msgs = db
    .prepare(`SELECT id, content, msgType FROM support_messages WHERE content IS NOT NULL AND TRIM(content) != ''`)
    .all() as Array<{ id: number; content: string; msgType: string }>;
  const updMsg = db.prepare(`UPDATE support_messages SET content = ? WHERE id = ?`);
  for (const row of msgs) {
    if (row.msgType !== 'image' && row.msgType !== 'voice') continue;
    const bn = basenameFromUrl(row.content);
    const to = map.get(bn);
    if (!to) continue;
    updMsg.run(to, row.id);
    updatedSupport += 1;
  }

  console.log(`[migrate:oss] uploaded: ${map.size}`);
  console.log(`[migrate:oss] products updated: ${updatedProducts}`);
  console.log(`[migrate:oss] support_messages updated: ${updatedSupport}`);
  console.log('[migrate:oss] done');
}

main().catch((err) => {
  console.error('[migrate:oss] failed', err);
  process.exit(1);
});

