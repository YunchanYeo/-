# 微信小程序 API 对接文档（中文）

韩文版本：`frontend/WECHAT_API_INTEGRATION.md`

## 1. 基本原则
- `wx.*` 是小程序运行时内置 API，无需安装
- 认证/支付/权限等敏感逻辑必须由后端校验
- 前端负责触发与展示，后端负责鉴权、校验、落库

## 2. 常见 API（本项目）
- `wx.login`：获取登录 `code`，上传后端换取会话
- `wx.getUserProfile`：用户授权后获取资料
- `wx.request`：由公共封装统一调用，不在页面层直接使用
- `wx.chooseMedia` / `wx.uploadFile`：上传图片/语音等媒体
- `wx.requestPayment`：发起支付流程

## 3. 注意事项
- 任何支付成功状态都以服务端回调/校验为准
- 所有请求统一错误处理，避免页面重复逻辑
