import 'dotenv/config';
import { Client } from 'pg';
import { getDb } from '../db';

const TABLES_IN_ORDER = [
  'product_categories',
  'products',
  'users',
  'admins',
  'user_addresses',
  'orders',
  'support_messages',
  'coupons',
  'user_coupons',
  'app_settings',
] as const;

function quoteIdent(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

async function ensureSchema(client: Client) {
  await client.query(`
CREATE TABLE IF NOT EXISTS product_categories (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  "sortOrder" BIGINT NOT NULL DEFAULT 0,
  thumbnail TEXT,
  "createdAt" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  price BIGINT NOT NULL,
  "originPrice" BIGINT,
  stock BIGINT NOT NULL,
  image TEXT,
  description TEXT,
  brand TEXT,
  company TEXT,
  "soldNum" BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ON',
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  category TEXT,
  "categoryId" BIGINT,
  unit TEXT NOT NULL DEFAULT '件'
);
CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY,
  openid TEXT NOT NULL UNIQUE,
  unionid TEXT,
  "sessionToken" TEXT,
  "nickName" TEXT,
  "avatarUrl" TEXT,
  gender BIGINT DEFAULT 0,
  "phoneNumber" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  points BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS admins (
  id BIGINT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  "passwordHash" TEXT,
  "sessionToken" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_addresses (
  id BIGINT PRIMARY KEY,
  "userId" BIGINT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  "countryName" TEXT DEFAULT '',
  "countryCode" TEXT DEFAULT '',
  "provinceName" TEXT DEFAULT '',
  "provinceCode" TEXT DEFAULT '',
  "cityName" TEXT DEFAULT '',
  "cityCode" TEXT DEFAULT '',
  "districtName" TEXT DEFAULT '',
  "districtCode" TEXT DEFAULT '',
  "detailAddress" TEXT DEFAULT '',
  "addressTag" TEXT DEFAULT '',
  "isDefault" BIGINT NOT NULL DEFAULT 0,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT PRIMARY KEY,
  "orderNo" TEXT NOT NULL UNIQUE,
  "userId" BIGINT NOT NULL,
  "totalAmount" BIGINT NOT NULL DEFAULT 0,
  "paymentAmount" BIGINT NOT NULL DEFAULT 0,
  "refundAmount" BIGINT NOT NULL DEFAULT 0,
  "refundStatus" BIGINT NOT NULL DEFAULT 0,
  "refundReason" TEXT,
  "refundedAt" TEXT,
  "orderStatus" BIGINT NOT NULL DEFAULT 10,
  "orderStatusName" TEXT NOT NULL DEFAULT '待发货',
  "itemsJson" TEXT NOT NULL DEFAULT '[]',
  "addressJson" TEXT NOT NULL DEFAULT '{}',
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL,
  "logisticsCompanyCode" TEXT,
  "logisticsCompanyName" TEXT,
  "logisticsNo" TEXT,
  "logisticsRemark" TEXT,
  "shippedAt" TEXT,
  "pointsUsed" BIGINT NOT NULL DEFAULT 0,
  "pointsEarned" BIGINT NOT NULL DEFAULT 0,
  "adminHidden" BIGINT NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS support_messages (
  id BIGINT PRIMARY KEY,
  "userId" BIGINT NOT NULL,
  "fromRole" TEXT NOT NULL,
  content TEXT NOT NULL,
  "adminRead" BIGINT NOT NULL DEFAULT 0,
  "userRead" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL,
  "msgType" TEXT NOT NULL DEFAULT 'text',
  "metaJson" TEXT
);
CREATE TABLE IF NOT EXISTS coupons (
  id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  type BIGINT NOT NULL DEFAULT 2,
  value BIGINT NOT NULL,
  base BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled',
  "startTime" BIGINT NOT NULL,
  "endTime" BIGINT NOT NULL,
  "totalCount" BIGINT NOT NULL DEFAULT 0,
  "issuedCount" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_coupons (
  id BIGINT PRIMARY KEY,
  "userId" BIGINT NOT NULL,
  "couponId" BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'default',
  "assignedAt" TEXT NOT NULL,
  "usedAt" TEXT,
  "orderNo" TEXT,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);
`);
}

async function copyTable(client: Client, table: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]!);
  const colSql = cols.map(quoteIdent).join(', ');
  const values: any[] = [];
  const tuples = rows.map((r, rowIdx) => {
    const placeholders = cols.map((_, colIdx) => `$${rowIdx * cols.length + colIdx + 1}`);
    for (const c of cols) values.push(r[c]);
    return `(${placeholders.join(', ')})`;
  });
  const sql = `INSERT INTO ${quoteIdent(table)} (${colSql}) VALUES ${tuples.join(', ')}`;
  await client.query(sql, values);
}

async function resetIdentity(client: Client, table: string) {
  const q = `
DO $$
DECLARE seq_name text;
BEGIN
  SELECT pg_get_serial_sequence('${table}', 'id') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    EXECUTE format('SELECT setval(%L, COALESCE((SELECT MAX(id) FROM ${table}), 1), true)', seq_name);
  END IF;
END$$;`;
  await client.query(q);
}

async function main() {
  const pgUrl = String(process.env.POSTGRES_URL || process.env.PG_URL || '').trim();
  if (!pgUrl) {
    throw new Error('Missing POSTGRES_URL (or PG_URL)');
  }
  const sqlite = getDb();
  const client = new Client({ connectionString: pgUrl });
  await client.connect();
  console.log('[migrate:pg] connected');

  try {
    await client.query('BEGIN');
    await ensureSchema(client);
    for (const t of [...TABLES_IN_ORDER].reverse()) {
      await client.query(`TRUNCATE TABLE ${quoteIdent(t)} RESTART IDENTITY CASCADE`);
    }
    for (const t of TABLES_IN_ORDER) {
      const rows = sqlite.prepare(`SELECT * FROM ${t}`).all() as Record<string, any>[];
      await copyTable(client, t, rows);
      console.log(`[migrate:pg] ${t}: ${rows.length} rows`);
    }
    for (const t of TABLES_IN_ORDER) {
      if (t !== 'app_settings') await resetIdentity(client, t);
    }
    await client.query('COMMIT');
    console.log('[migrate:pg] done');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[migrate:pg] failed', err);
  process.exit(1);
});

