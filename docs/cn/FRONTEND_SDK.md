# 前端数据联动指南（中文）

韩文版本：`frontend/docs/FRONTEND_SDK.md`

## 1. 核心原则
- 页面层（`pages/**`）负责展示与交互
- 服务层（`services/**`）负责 API 调用与数据转换
- 统一通过 `services/_utils/http.js` 的 `requestJson()` 发起请求
- 页面里不要直接调用 `wx.request()`

推荐流程：

```text
Page -> Service -> requestJson -> Backend API -> DB
```

## 2. 开发建议
- 每个业务域在 `services/` 中拆分独立模块
- 页面仅处理 UI 状态，不承载复杂业务规则
- Mock 和真实 API 保持相同数据结构，便于切换
