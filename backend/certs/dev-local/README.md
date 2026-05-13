# 로컬 HTTPS（微信小程序）

新版基础库对 `<image>` / 组件图要求 **HTTPS**，`http://127.0.0.1` 会报「不支持 HTTP」。

1. 生成自签名证书（仓库根目录 `backend` 下执行）：

   ```bash
   npm run gen:dev-tls
   ```

2. 重启后端：出现日志 `listening on https://0.0.0.0:3000` 即生效。

3. 前端 `frontend/config/runtime.js` 中 `LOCAL_API_BASE` 应为 **`https://127.0.0.1:3000`**（与证书一致）。

4. 开发者工具：**详情 → 本地设置 → 不校验合法域名**；若浏览器仍不信任自签证书，可用 [mkcert](https://github.com/FiloSottile/mkcert) 生成本地信任的证书并替换 `key.pem` / `cert.pem`。

5. `.env` 若配置了 `PUBLIC_UPLOAD_BASE_URL`，本地请改为 **`https://127.0.0.1:3000`** 或删除该项（由请求的 Host 推导）。

`*.pem` 已 gitignore，勿提交。
