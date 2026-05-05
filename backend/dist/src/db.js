import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbFilePath = path.join(__dirname, '..', 'data', 'app.sqlite');
fs.mkdirSync(path.dirname(dbFilePath), { recursive: true });
const db = new Database(dbFilePath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
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
        db.exec(`ALTER TABLE products ADD COLUMN ${ddl};`);
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
        db.exec(`ALTER TABLE orders ADD COLUMN ${ddl};`);
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
  sessionToken TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);
`);
const adminCount = db.prepare(`SELECT COUNT(*) as c FROM admins`).get()?.c ?? 0;
if (adminCount === 0) {
    db.prepare(`INSERT INTO admins (username, password, createdAt, updatedAt)
     VALUES (?, ?, datetime('now'), datetime('now'))`).run('yuc010100', 'chan200600@');
}
export function getDb() {
    return db;
}
