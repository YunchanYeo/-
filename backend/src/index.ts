import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bootstrapAdminIfDbEmpty, syncAdminPasswordFromEnvOnStart } from './adminBootstrap';
import { getDb } from './db';
import { createServices } from './services/serviceRegistry';
import { createApiController } from './controllers/apiController';
import { createApiRouter } from './routes/apiRouter';
import { loadWechatPayConfigFromEnv } from './services/wechatPayV3';

const app = express();
app.set('trust proxy', 1);
app.use(cors());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });
const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

const db = getDb();
await bootstrapAdminIfDbEmpty(db);
await syncAdminPasswordFromEnvOnStart(db);
const paymentMockMode = process.env.WECHAT_PAY_MOCK !== 'false';
const wechatAppId = process.env.WECHAT_APPID || '';
const wechatAppSecret = process.env.WECHAT_APPSECRET || '';
const wechatPayConfig = loadWechatPayConfigFromEnv();

const services = createServices({ db, uploadsDir, paymentMockMode, wechatAppId, wechatAppSecret, wechatPayConfig });
const apiController = createApiController(services);

/** 微信支付异步通知：须使用原始 body 校验签名（application/json） */
app.post(
  '/api/wechat-pay/notify',
  express.raw({ type: '*/*', limit: '1mb' }),
  (req, res, next) => {
    void Promise.resolve(services.order.wechatPayNotify(req, res)).catch(next);
  },
);

app.use(express.json());
const apiRouter = createApiRouter(apiController);
app.use('/api', apiRouter);

app.use((err: any, req: any, res: any, next: any) => {
  console.error(err);
  res.status(500).json({ ok: false, message: 'Internal Server Error' });
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`[backend] listening on http://127.0.0.1:${port}`);
});

