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

若使用 Docker：在自行编写的 `docker-compose.yml` 中为 backend 配置 **`env_file: ../../backend/.env`**（路径按实际 compose 文件位置调整），变量在**创建容器时**注入；修改服务器上的 `backend/.env` 后请重建后端容器，例如：

```bash
cd <compose 所在目录>
docker compose up -d --no-deps --force-recreate backend
```

运维与微信域名说明见 **`docs/kr/DEPLOY_CN_WECHAT.md`**。

### 自检：商户签名是否被微信支付接受（不下单）

在 `backend` 目录、已配置 `.env`（及/或本目录 `apiclient_key.pem`）时执行：

```bash
npm run probe:wechat-pay
```

- **成功**：`WECHAT_MCH_ID`、`WECHAT_PAY_SERIAL_NO`、私钥与商户平台一致（至少能通过 `GET /v3/certificates`）。
- **失败**：多为序列号与私钥不匹配、私钥 PEM 错误、或商户号错误；响应体会打印微信支付返回的错误摘要（不含密钥原文）。

**不检查**：`WECHAT_PAY_API_V3_KEY` 是否正确（该密钥用于回调体解密；脚本内若长度不是 32 字节会警告）。**不检查**：小程序 `openid` 或 `WECHAT_PAY_NOTIFY_URL` 是否可达。

若 `GET /v3/certificates` 返回 404（无平台证书），脚本会自动发一笔 **无效 openid** 的 JSAPI 试探：若返回 `APPID_MCHID_NOT_MATCH` 等 **业务类错误**（非 401 签名错误），通常表示 **商户证书序列号 + 私钥已被微信支付接受**；此时请核对 **小程序 AppID 与商户号是否已在商户平台绑定**。
