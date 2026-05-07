# 项目文档索引 (CN)

本仓库包含 `frontend`（小程序）、`admin-web`（React 管理后台）、`backend`（Express API）。

## 文档地图

- 用户运营手册：`docs/cn/USER_GUIDE.md`
- 开发者指南：`docs/cn/DEV_GUIDE.md`
- 优化报告：`docs/cn/OPTIMIZATION_REPORT.md`
- 韩文文档索引：`docs/kr/README.md`

## 快速启动

- 后端：`cd backend && npm install && npm run dev`
- 管理后台：`cd admin-web && npm install && npm run dev`
- 小程序：使用微信开发者工具打开 `frontend`

## 最新功能概览

- 订单管理
  - 管理员视图订单隐藏/恢复（`选中隐藏`、`选中恢复`、`查看已隐藏`、`恢复全部`）
  - 账号级可见性持久化（`GET/PUT /api/admin/order-visibility`）
  - Excel 导入增强（中英列头兼容、dry-run、失败重试、失败导出）
  - 订单列表虚拟滚动
- 物流地图
  - 管理后台轨迹弹窗使用 `Leaflet + OSM`（免 Key）
- 客服聊天
  - 小程序用户端/小程序管理端/React 管理端均支持表情面板
  - 支持“对方正在输入…”提示
  - 输入状态 API：
    - 用户端：`GET/POST /api/support/typing`
    - 管理端：`GET/POST /api/admin/support/typing/:userId`

## 目录概览

```text
frontend/   # 小程序（用户端/管理端页面）
admin-web/  # React 管理后台
backend/    # Express + SQLite 服务
docs/kr/    # 韩文文档
docs/cn/    # 中文文档
```

## 验证命令

- 后端构建/测试：`cd backend && npm run build && npm test`
- 管理端构建：`cd admin-web && npm run build`
