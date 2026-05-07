# 开发者指南 (CN)

## 1) 架构

- `frontend`：微信小程序（用户端/管理端）
- `admin-web`：React + TypeScript + Vite 管理后台
- `backend`：Express + TypeScript + SQLite
- 小程序与后台共用 `/api/*`

## 2) 本地启动

- 后端：`cd backend && npm install && npm run dev`
- 管理后台：`cd admin-web && npm install && npm run dev`
- 小程序：微信开发者工具打开 `frontend`
- 小程序 API 地址：`frontend/config/index.js` 的 `apiBaseUrl`

## 3) 核心实现

### 订单模块（管理后台）

- 隐藏/恢复仅影响管理员视图，不删除数据库订单
- 可见性接口：`GET/PUT /api/admin/order-visibility`
- Excel 导入增强：
  - 中英列头兼容
  - dry-run 预检
  - 失败项自动重试
  - 失败项导出 Excel
- 大列表性能：windowing 虚拟滚动

### 客服聊天

- 公共运行时：`frontend/services/support/chatPageRuntime.js`
- 小程序用户端/管理端：
  - 文本/图片/语音
  - 表情面板
  - 对方输入中提示（`对方正在输入…`）
- React 管理端：
  - 会话列表
  - 媒体上传
  - 表情面板
  - 对方输入中提示

### 输入状态(typing)接口

- 用户接口：
  - `GET /api/support/typing`
  - `POST /api/support/typing`（`{ typing: boolean }`）
- 管理接口：
  - `GET /api/admin/support/typing/:userId`
  - `POST /api/admin/support/typing/:userId`（`{ typing: boolean }`）
- 服务端使用内存 TTL 维护 typing 状态

## 4) 代码位置

- 路由：`backend/src/routes/apiRouter.ts`
- 控制器：`backend/src/controllers/apiController.ts`
- 聊天服务：`backend/src/services/supportService.ts`
- 小程序聊天 API：`frontend/services/support/chat.js`
- React 管理 API：`admin-web/src/api/admin.ts`

## 5) 开发注意事项

- `backend/dist` 是编译产物（JS），源码仅在 `backend/src`
- SQLite 为 WAL 模式，排查数据时注意 WAL 可见性
- 小程序与后台应指向同一个后端地址

## 6) 验证清单

- 后端：`cd backend && npm run build && npm test`
- 管理后台：`cd admin-web && npm run build`
- 聊天回归：
  - 文本/图片/语音发送
  - 表情输入
  - `对方正在输入…` 展示与消失
  - 页面切换后 typing 状态清理
