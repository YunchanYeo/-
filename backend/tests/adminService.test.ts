import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createAdminService } from '../src/services/adminService';

function createRes() {
  const out: { statusCode: number; body: any } = { statusCode: 200, body: null };
  const res = {
    status(code: number) {
      out.statusCode = code;
      return this;
    },
    json(payload: any) {
      out.body = payload;
      return this;
    },
  };
  return { res: res as any, out };
}

function setupDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT,
      passwordHash TEXT,
      sessionToken TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );
  `);
  return db;
}

describe('adminService account update', () => {
  it('updates username and returns updated admin payload', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO admins (username, password, sessionToken) VALUES (?, ?, ?)`).run(
      'admin',
      'old-pass',
      'token-1',
    );

    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
    const service = createAdminService({ db: db as any, uploadsDir });
    const { res, out } = createRes();
    const req = {
      body: { currentPassword: 'old-pass', newUsername: 'admin_new' },
      params: {},
      admin: { id: 1 },
    } as any;

    await service.adminUpdateUsername(req, res);

    expect(out.statusCode).toBe(200);
    expect(out.body?.ok).toBe(true);
    expect(out.body?.data?.username).toBe('admin_new');

    const row = db.prepare(`SELECT username, sessionToken FROM admins WHERE id = 1`).get() as any;
    expect(row.username).toBe('admin_new');
    expect(row.sessionToken).toBeNull();
  });

  it('updates password and invalidates existing session token', async () => {
    const db = setupDb();
    db.prepare(`INSERT INTO admins (username, password, sessionToken) VALUES (?, ?, ?)`).run(
      'admin',
      'old-pass',
      'token-1',
    );

    const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'uploads-'));
    const service = createAdminService({ db: db as any, uploadsDir });
    const { res, out } = createRes();
    const req = {
      body: { currentPassword: 'old-pass', newPassword: 'new-pass-123' },
      params: {},
      admin: { id: 1 },
    } as any;

    await service.adminUpdatePassword(req, res);

    expect(out.statusCode).toBe(200);
    expect(out.body?.ok).toBe(true);

    const row = db.prepare(`SELECT passwordHash, sessionToken FROM admins WHERE id = 1`).get() as any;
    expect(typeof row.passwordHash).toBe('string');
    expect(row.passwordHash.length).toBeGreaterThan(20);
    expect(row.sessionToken).toBeNull();
  });
});
