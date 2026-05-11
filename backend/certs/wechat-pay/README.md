# 微信支付 API 证书（商户）

将微信商户平台下载的压缩包内文件放在本目录：

- `apiclient_key.pem` — 商户私钥（必填，用于 JSAPI 签名）
- `apiclient_cert.pem` — 商户证书
- `apiclient_cert.p12` — 可选
- `wechatpay_cert.pem` — **平台证书**（可选；从商户平台「API 安全 → 平台证书」下载后放入，用于支付回调验签）

`.env` 中 **`WECHAT_PAY_PRIVATE_KEY` 可留空**：后端会自动读取本目录下的 `apiclient_key.pem`（与 Docker 镜像内 `COPY certs` 一致）。

### `WECHAT_PAY_PRIVATE_KEY` 内联写入（可选）

若不用文件、改在环境变量里放 PEM，须**整段 PEM 原文**，包括首尾行，例如：

- `-----BEGIN PRIVATE KEY-----`（或商户包给出的 `BEGIN RSA PRIVATE KEY` 等）
- 中间 Base64 行
- `-----END PRIVATE KEY-----`

`.env` 单行时：换行写成 **`\n`**（后端会把 `\\n` 还原为真实换行）。无 PEM 头尾的纯 Base64 不能用于签名。

亦可设置 **`WECHAT_PAY_PRIVATE_KEY_FILE`** 为宿主机上 `apiclient_key.pem` 的绝对路径（非 Docker 场景或自行挂载时）。

平台证书：若未配置 `WECHAT_PAY_PLATFORM_CERT_PEM`，可放置 `wechatpay_cert.pem` 或设置 `WECHAT_PAY_PLATFORM_CERT_FILE`。

**勿将 `*.pem` / `*.p12` 提交到 Git**（已在 `backend/.gitignore` 忽略）。

### 修改 `.env` 后让线上后端生效（Docker Compose）

`deploy/china-test/docker-compose.yml` 使用 **`env_file: ../../backend/.env`**，变量在**容器创建时**注入；改完服务器上的 `backend/.env` 后请重建后端容器，例如：

```bash
cd <레포>/deploy/china-test
docker compose up -d --no-deps --force-recreate backend
```

从本机同步：可用 `bash deploy/china-test/push-from-mac.sh`（上传 `.env` 并 compose）。

运维说明（含「多个 `china-test` 目录时如何确认」）：`docs/kr/DEPLOY_CN_WECHAT.md` 第 5 节补充小节。
