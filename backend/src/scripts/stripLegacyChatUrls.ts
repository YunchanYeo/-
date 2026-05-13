import 'dotenv/config';
import { getDb } from '../db';

/** 로컬 전용: 예전 공개 업로드 호스트가 DB 에 풀 URL 로 박혀 있으면 path 만 남김 → 더 이상 해당 도메인으로 요청 안 감 */
const LEGACY_HOST = 'hebibingtest.shop';

function toPathOnly(url: string): string | null {
  const raw = String(url || '').trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  try {
    const u = new URL(raw);
    const h = u.hostname.toLowerCase().replace(/^www\./, '');
    if (h !== LEGACY_HOST) return null;
    return `${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

async function main() {
  const db = getDb();
  const rows = db
    .prepare(`SELECT id, content FROM support_messages WHERE content LIKE ?`)
    .all(`%${LEGACY_HOST}%`) as { id: number; content: string }[];
  let n = 0;
  for (const r of rows) {
    const next = toPathOnly(r.content);
    if (next == null) continue;
    db.prepare(`UPDATE support_messages SET content = ? WHERE id = ?`).run(next, r.id);
    n += 1;
  }
  console.log(`[strip-legacy-chat-host] support_messages updated: ${n} / scanned ${rows.length}`);

  const avRows = db
    .prepare(`SELECT id, avatarUrl FROM users WHERE avatarUrl LIKE ?`)
    .all(`%${LEGACY_HOST}%`) as { id: number; avatarUrl: string }[];
  let a = 0;
  for (const r of avRows) {
    const next = toPathOnly(r.avatarUrl);
    if (next == null) continue;
    db.prepare(`UPDATE users SET avatarUrl = ?, updatedAt = datetime('now') WHERE id = ?`).run(next, r.id);
    a += 1;
  }
  console.log(`[strip-legacy-chat-host] users.avatarUrl updated: ${a} / scanned ${avRows.length}`);
  console.log('[strip-legacy-chat-host] 小程序端请清除缓存或删掉 storage 里 prefetch.support.messages');
}

main().catch((err) => {
  console.error('[strip-legacy-chat-host] failed', err);
  process.exit(1);
});
