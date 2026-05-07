import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { createOrderService } from '../src/services/orderService';

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
    CREATE TABLE orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderNo TEXT NOT NULL,
      userId INTEGER NOT NULL,
      logisticsCompanyCode TEXT,
      logisticsCompanyName TEXT,
      logisticsNo TEXT,
      addressJson TEXT
    );
  `);
  return db;
}

const oldKey = process.env.KUAIDI100_KEY;
const oldCustomer = process.env.KUAIDI100_CUSTOMER;

afterEach(() => {
  process.env.KUAIDI100_KEY = oldKey;
  process.env.KUAIDI100_CUSTOMER = oldCustomer;
});

describe('order logistics trace', () => {
  it('returns configured=false when kuaidi env is missing', async () => {
    process.env.KUAIDI100_KEY = '';
    process.env.KUAIDI100_CUSTOMER = '';
    const db = setupDb();
    db.prepare(
      `INSERT INTO orders (orderNo, userId, logisticsCompanyCode, logisticsCompanyName, logisticsNo, addressJson)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run('NO123', 8, '', '韵达快递', '465297765550956', '{}');

    const service = createOrderService({ db: db as any, paymentMockMode: true });
    const { res, out } = createRes();
    const req = {
      params: { orderNo: 'NO123' },
      user: { id: 8 },
    } as any;

    await service.orderLogisticsTrace(req, res);

    expect(out.statusCode).toBe(200);
    expect(out.body?.ok).toBe(true);
    expect(out.body?.data?.configured).toBe(false);
    expect(out.body?.data?.logisticsNo).toBe('465297765550956');
  });
});
