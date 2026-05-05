import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
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
function isSqliteBusyError(err) {
    const msg = String(err?.message || '');
    const code = String(err?.code || '');
    return msg.includes('database is locked') || code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED';
}
function execWithLockHint(sql) {
    try {
        db.exec(sql);
    }
    catch (err) {
        if (isSqliteBusyError(err)) {
            throw new Error(`SQLite is locked while running migration. ` +
                `Please stop duplicate backend processes and restart one backend instance. Original: ${err?.message || err}`);
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
const existingColumns = db.prepare("PRAGMA table_info('products')").all().map((c) => c.name);
const ensureColumn = (name, ddl) => {
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
const orderColumns = db.prepare("PRAGMA table_info('orders')").all().map((c) => c.name);
const ensureOrderColumn = (name, ddl) => {
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
const adminColumns = db.prepare("PRAGMA table_info('admins')").all().map((c) => c.name);
const ensureAdminColumn = (name, ddl) => {
    if (!adminColumns.includes(name)) {
        execWithLockHint(`ALTER TABLE admins ADD COLUMN ${ddl};`);
        adminColumns.push(name);
    }
};
ensureAdminColumn('passwordHash', 'passwordHash TEXT');
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
const supportColumns = db.prepare("PRAGMA table_info('support_messages')").all().map((c) => c.name);
const ensureSupportColumn = (name, ddl) => {
    if (!supportColumns.includes(name)) {
        execWithLockHint(`ALTER TABLE support_messages ADD COLUMN ${ddl};`);
        supportColumns.push(name);
    }
};
ensureSupportColumn('msgType', "msgType TEXT NOT NULL DEFAULT 'text'");
ensureSupportColumn('metaJson', 'metaJson TEXT');
// Default admin creation has been removed for security.
// Use `npm run seed:admin` and environment variables instead.
export function getDb() {
    return db;
}
