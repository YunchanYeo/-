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

const app = express();
app.use(cors());
app.use(express.json());

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

const services = createServices({ db, uploadsDir, paymentMockMode, wechatAppId, wechatAppSecret });
const apiController = createApiController(services);
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

