import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { LEGACY_LABELS_BY_CANONICAL } from './categoryLegacy';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, '..', 'data', 'app.sqlite');

fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });

// Increase SQLite busy timeout to reduce "database is locked" during concurrent requests/dev hot-reload.
const db = new Database(dbFilePath, { timeout: 5000 });
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

function isSqliteBusyError(err: unknown) {
  const msg = String((err as any)?.message || '');
  const code = String((err as any)?.code || '');
  return msg.includes('database is locked') || code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED';
}

function execWithLockHint(sql: string) {
  try {
    db.exec(sql);
  } catch (err: any) {
    if (isSqliteBusyError(err)) {
      throw new Error(
        `SQLite is locked while running migration. ` +
          `Please stop duplicate backend processes and restart one backend instance. Original: ${err?.message || err}`,
      );
    }
    throw err;
  }
}

db.exec(`
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  originPrice INTEGER,
  stock INTEGER NOT NULL,
  image TEXT,
  description TEXT,
  brand TEXT,
  company TEXT,
  soldNum INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ON',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const existingColumns = db.prepare("PRAGMA table_info('products')").all().map((c: any) => c.name);
const ensureColumn = (name: string, ddl: string) => {
  if (!existingColumns.includes(name)) {
    execWithLockHint(`ALTER TABLE products ADD COLUMN ${ddl};`);
  }
};

ensureColumn('originPrice', 'originPrice INTEGER');
ensureColumn('image', 'image TEXT');
ensureColumn('description', 'description TEXT');
ensureColumn('brand', 'brand TEXT');
ensureColumn('company', 'company TEXT');
ensureColumn('soldNum', "soldNum INTEGER NOT NULL DEFAULT 0");
ensureColumn('category', 'category TEXT');
ensureColumn('categoryId', 'categoryId INTEGER');

/** 관리자 상품 이미지(BLOB) — `/api/media/product/:id` 로 제공 */
db.exec(`
CREATE TABLE IF NOT EXISTS product_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mimeType TEXT NOT NULL,
  data BLOB NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS product_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  thumbnail TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const categoryRowCount = db.prepare(`SELECT COUNT(*) as c FROM product_categories`).get() as { c: number };
if (categoryRowCount.c === 0) {
  const insert = db.prepare(`INSERT INTO product_categories (name, sortOrder) VALUES (?, ?)`);
  const defaults = ['面', '零食', '饮料', '饭', '罐头'];
  const run = db.transaction((names: string[]) => {
    names.forEach((name, i) => insert.run(name, i));
  });
  run(defaults);
}

// 商品.category 文本与 product_categories.name 一致时，补全 categoryId，便于按分类 id 筛选
try {
  db.exec(`
    UPDATE products SET categoryId = (
      SELECT pc.id FROM product_categories pc
      WHERE TRIM(pc.name) = TRIM(products.category)
      LIMIT 1
    )
    WHERE products.category IS NOT NULL AND TRIM(products.category) != ''
  `);
} catch (err) {
  console.warn('[db] categoryId backfill skipped:', err);
}

// 历史叶子分类名 → 当前主分类名 + categoryId（与 categoryLegacy 一致）
try {
  for (const [canonical, legacyList] of Object.entries(LEGACY_LABELS_BY_CANONICAL)) {
    if (!legacyList.length) continue;
    const row = db.prepare(`SELECT id FROM product_categories WHERE TRIM(name) = ? LIMIT 1`).get(canonical) as { id: number } | undefined;
    if (!row) continue;
    const upd = db.prepare(
      `UPDATE products SET category = ?, categoryId = ?, updatedAt = datetime('now') WHERE TRIM(COALESCE(category,'')) = ?`,
    );
    for (const leg of legacyList) {
      upd.run(canonical, row.id, leg);
    }
  }
} catch (err) {
  console.warn('[db] legacy category normalize skipped:', err);
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  openid TEXT NOT NULL UNIQUE,
  unionid TEXT,
  sessionToken TEXT,
  nickName TEXT,
  avatarUrl TEXT,
  gender INTEGER DEFAULT 0,
  phoneNumber TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const userTableCols = db.prepare("PRAGMA table_info('users')").all().map((c: any) => c.name);
if (!userTableCols.includes('points')) {
  execWithLockHint(`ALTER TABLE users ADD COLUMN points INTEGER NOT NULL DEFAULT 0`);
}

db.exec(`
CREATE TABLE IF NOT EXISTS user_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  countryName TEXT DEFAULT '',
  countryCode TEXT DEFAULT '',
  provinceName TEXT DEFAULT '',
  provinceCode TEXT DEFAULT '',
  cityName TEXT DEFAULT '',
  cityCode TEXT DEFAULT '',
  districtName TEXT DEFAULT '',
  districtCode TEXT DEFAULT '',
  detailAddress TEXT DEFAULT '',
  addressTag TEXT DEFAULT '',
  isDefault INTEGER NOT NULL DEFAULT 0,
  latitude REAL,
  longitude REAL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderNo TEXT NOT NULL UNIQUE,
  userId INTEGER NOT NULL,
  totalAmount INTEGER NOT NULL DEFAULT 0,
  paymentAmount INTEGER NOT NULL DEFAULT 0,
  refundAmount INTEGER NOT NULL DEFAULT 0,
  refundStatus INTEGER NOT NULL DEFAULT 0,
  refundReason TEXT,
  refundedAt TEXT,
  orderStatus INTEGER NOT NULL DEFAULT 10,
  orderStatusName TEXT NOT NULL DEFAULT '待发货',
  itemsJson TEXT NOT NULL DEFAULT '[]',
  addressJson TEXT NOT NULL DEFAULT '{}',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
`);

// 管理端订单隐藏表：仅影响管理员后台列表，不影响用户侧订单数据。
db.exec(`
CREATE TABLE IF NOT EXISTS admin_hidden_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderNo TEXT NOT NULL UNIQUE,
  adminId INTEGER,
  hiddenAt TEXT NOT NULL DEFAULT (datetime('now')),
  note TEXT,
  FOREIGN KEY (orderNo) REFERENCES orders(orderNo) ON DELETE CASCADE,
  FOREIGN KEY (adminId) REFERENCES admins(id) ON DELETE SET NULL
);
`);

const orderColumns = db.prepare("PRAGMA table_info('orders')").all().map((c: any) => c.name);
const ensureOrderColumn = (name: string, ddl: string) => {
  if (!orderColumns.includes(name)) {
    execWithLockHint(`ALTER TABLE orders ADD COLUMN ${ddl};`);
  }
};

ensureOrderColumn('refundAmount', "refundAmount INTEGER NOT NULL DEFAULT 0");
ensureOrderColumn('refundStatus', "refundStatus INTEGER NOT NULL DEFAULT 0");
ensureOrderColumn('refundReason', 'refundReason TEXT');
ensureOrderColumn('refundedAt', 'refundedAt TEXT');
ensureOrderColumn('logisticsCompanyCode', 'logisticsCompanyCode TEXT');
ensureOrderColumn('logisticsCompanyName', 'logisticsCompanyName TEXT');
ensureOrderColumn('logisticsNo', 'logisticsNo TEXT');
ensureOrderColumn('logisticsRemark', 'logisticsRemark TEXT');
ensureOrderColumn('shippedAt', 'shippedAt TEXT');
ensureOrderColumn('pointsUsed', "pointsUsed INTEGER NOT NULL DEFAULT 0");
ensureOrderColumn('pointsEarned', "pointsEarned INTEGER NOT NULL DEFAULT 0");
ensureOrderColumn('adminHidden', "adminHidden INTEGER NOT NULL DEFAULT 0");

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  passwordHash TEXT,
  sessionToken TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const adminColumns = db.prepare("PRAGMA table_info('admins')").all().map((c: any) => c.name);
const ensureAdminColumn = (name: string, ddl: string) => {
  if (!adminColumns.includes(name)) {
    execWithLockHint(`ALTER TABLE admins ADD COLUMN ${ddl};`);
    adminColumns.push(name);
  }
};
ensureAdminColumn('passwordHash', 'passwordHash TEXT');

// 관리자 다중 단말 세션: 계정당 1개 활성 세션(같은 계정 재로그인 시 기존 세션 만료)
db.exec(`
CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  adminId INTEGER NOT NULL UNIQUE,
  token TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (adminId) REFERENCES admins(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS support_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  fromRole TEXT NOT NULL CHECK (fromRole IN ('user', 'admin')),
  content TEXT NOT NULL,
  adminRead INTEGER NOT NULL DEFAULT 0,
  userRead INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
`);

const supportColumns = db.prepare("PRAGMA table_info('support_messages')").all().map((c: any) => c.name);
const ensureSupportColumn = (name: string, ddl: string) => {
  if (!supportColumns.includes(name)) {
    execWithLockHint(`ALTER TABLE support_messages ADD COLUMN ${ddl};`);
    supportColumns.push(name);
  }
};
ensureSupportColumn('msgType', "msgType TEXT NOT NULL DEFAULT 'text'");
ensureSupportColumn('metaJson', 'metaJson TEXT');

db.exec(`
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type INTEGER NOT NULL DEFAULT 2, -- 2=满减(分), 1=折扣(如 85 = 8.5折)
  value INTEGER NOT NULL,
  base INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'enabled',
  startTime INTEGER NOT NULL,
  endTime INTEGER NOT NULL,
  totalCount INTEGER NOT NULL DEFAULT 0,
  issuedCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS user_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId INTEGER NOT NULL,
  couponId INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'default',
  assignedAt TEXT NOT NULL DEFAULT (datetime('now')),
  usedAt TEXT,
  orderNo TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (couponId) REFERENCES coupons(id) ON DELETE CASCADE
);
`);

db.exec(`
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const pointsRateSetting = db.prepare(`SELECT key FROM app_settings WHERE key = 'pointsEarnRatePercent'`).get() as { key: string } | undefined;
if (!pointsRateSetting) {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`).run('pointsEarnRatePercent', '1');
}
const pointsThresholdSetting = db
  .prepare(`SELECT key FROM app_settings WHERE key = 'pointsUseThreshold'`)
  .get() as { key: string } | undefined;
if (!pointsThresholdSetting) {
  db.prepare(`INSERT INTO app_settings (key, value) VALUES (?, ?)`).run('pointsUseThreshold', '1000');
}

// Default admin creation has been removed for security.
// Use `npm run seed:admin` and environment variables instead.

export function getDb() {
  return db;
}
