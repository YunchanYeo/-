# Backend 开发指南（中文）

韩文版本：`backend/README.md`

## 1. 技术栈
- Node.js
- Express
- TypeScript (ESM)
- SQLite (`better-sqlite3`)
- `zod`, `bcrypt`

## 2. 启动方式
```bash
cd backend
npm install
npm run dev
```

默认端口：`3000`，健康检查：`GET /api/health`

## 3. TypeScript 与 dist
- 源码在 `src/*.ts`
- `npm run build` 会编译到 `dist/*.js`
- `dist` 是构建产物，不是源码（不要手改）

## 4. 主要 Admin API（新增含可见性）
- `POST /api/admin/login`
- `GET /api/admin/me`
- `GET /api/admin/orders`
- `POST /api/admin/orders/:orderNo/shipping`
- `PUT /api/admin/orders/:orderNo/status`
- `GET /api/admin/orders/:orderNo/logistics-trace`
- `GET /api/admin/order-visibility`
- `PUT /api/admin/order-visibility`

## 5. 常见问题
- SQLite 锁冲突：确认没有重复启动多个后端进程
- `dist` 里出现 JS：这是正常编译输出
