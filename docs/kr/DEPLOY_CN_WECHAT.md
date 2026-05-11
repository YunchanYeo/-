# 중국 ECS + 微信小程序 배포 가이드 (통합본)

한 파일로 정리했습니다. (HTML 앵커·문서 간 링크 최소화)

**공식 위챗 네트워크 규정**: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html

---

## 1. 무엇을 배포하는지

- **backend**: API (Docker에서 보통 3000)
- **admin-web**: 관리자 SPA + nginx (`/api` 는 백엔드로 프록시)
- **caddy**: 80/443 에서 HTTPS(Let’s Encrypt) 종료 후 `admin-web` 으로 전달
- **frontend**(미니프로그램): 위챗 개발자도구에서 이 폴더 열기

외부에서는 **443 HTTPS** 만 쓰면 됩니다. `docker-compose` 기본은 관리자 nginx 를 **`127.0.0.1:8080`** 에만 열어 두어, 공인 IP:8080 으로는 접속되지 않습니다.

---

## 2. ECS 보안그룹 / 방화벽

열어둘 포트(예시):

- **22** SSH
- **80** HTTP (Let’s Encrypt 인증용)
- **443** HTTPS
- **3000** (선택) 백엔드 직접 점검용. 운영에서는 막아도 됨.

---

## 3. 서버에 Docker 설치 (최초 1회)

```bash
sudo apt update
sudo apt install -y git ca-certificates curl
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

재로그인 후 `docker compose version` 확인.

---

## 4. 레포 클론과 작업 디렉터리

클론 예시:

```bash
git clone <저장소-URL>
cd <클론-폴더-이름>
```

Docker 를 돌리는 디렉터리는 항상 **`deploy/china-test`** 입니다.

**ECS에서 자주 쓰는 경로 예시** (본인 서버에 맞게 바꿈):

```bash
cd /root/wechat-app-live/deploy/china-test
```

위치를 모를 때 (`deploy/china-test`만 좁혀 찾기):

```bash
find /root /home -maxdepth 6 -path "*/deploy/china-test" -type d 2>/dev/null
```

또는:

```bash
find /root -name "docker-compose.yml" 2>/dev/null | grep china-test
```

**여러 개** 나오면(예: `wechat-app-live`, `wechat-app`, `*.backup-*`) **지금 떠 있는 백엔드가 어느 compose 로 올라갔는지** 확인:

```bash
docker inspect wechat-backend --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'
```

출력 경로의 `docker-compose.yml` 이 있는 디렉터리가 **`cd` 해야 할 `deploy/china-test`** 입니다. 잘못된 트리의 `.env` 를 고치면 반영되지 않습니다.

**셸 한 줄에 명령 하나만** 입력합니다. `docker compose up -d 또는 restart` 처럼 한글까지 붙이면 실패합니다.

---

## 5. 환경 변수와 기동

1. `backend/.env` 설정 (WeChat, 관리자, OSS 등). **비밀값은 Git 에 올리지 않기.**

2. 기동:

```bash
cd <레포>/deploy/china-test
docker compose up -d --build
docker compose ps
docker compose logs --tail=50 caddy
```

3. 확인:
   - 브라우저: `https://<sslip-호스트>/api/health`  
     sslip 형식: IP `39.106.213.185` → 호스트 `39-106-213-185.sslip.io`
   - ECS 안에서 관리 UI 점검: `curl -sS http://127.0.0.1:8080/`

### 5.1 `backend/.env` 만 수정한 뒤 반영

Compose 의 `env_file` 은 컨테이너 **재생성** 시 안전하게 다시 읽힙니다. 서버에서 `backend/.env` 저장 후, **실제 운영 중인** `deploy/china-test` 로 이동해:

```bash
docker compose up -d --no-deps --force-recreate backend
```

`docker compose restart backend` 만으로는 환경 변수가 남는 경우가 있어, **위 한 줄**을 권장합니다. 맥에서 `.env` 까지 올리고 기동까지 한 번에: 레포 루트에서 `bash deploy/china-test/push-from-mac.sh`.

로컬에서 `node` 직접 실행 시에는 프로세스를 **다시 시작**하면 됩니다.

### 5.2 微信支付 등 인증서·私钥

- **권장**: `backend/certs/wechat-pay/apiclient_key.pem` 등 파일 배치,`.env` 의 `WECHAT_PAY_PRIVATE_KEY` 는 비움. PEM 전문·`BEGIN`/`END` 줄 포함 여부·Docker 반영 절차는 **`backend/certs/wechat-pay/README.md`** 참고.

### 5.3 서버에서 SSL 빠르게 확인 (선택, 맥 LibreSSL 은 `-brief` 없음)

```bash
echo | openssl s_client -connect 39-106-213-185.sslip.io:443 -servername 39-106-213-185.sslip.io 2>&1 | head -50
```

스크립트: `deploy/china-test/check-ssl.sh` (레포에 있으면 같은 디렉터리에서 `bash check-ssl.sh`)

---

## 6. 微信小程序 (미니프로그램) 연결

### 6.1 위챗 백오피스

1. https://mp.weixin.qq.com 로그인  
2. **开发 → 开发管理 → 开发设置 → 服务器域名**  
3. **request合法域名**: 호스트만 (예: `39-106-213-185.sslip.io`). `https://` 붙이지 않음.  
4. 이미지·다운로드가 같은 도메인이면 **download合法域名** 도 추가.

### 6.2 이 프로젝트 `frontend/config/index.js`

- **`CLOUD_HTTPS_API_BASE`**: sslip 전체 URL (`https://39-106-213-185.sslip.io` 형태). IP 바뀌면 sslip 호스트도 바꿈.  
- **`CLOUD_HTTPS_API_BASE_OVERRIDE`**: 정식 도메인 쓸 때만 예) `'https://api.example.com'` (끝 `/` 없음). 비우면 sslip 사용.  
- 시뮬레이터는 기본 **`http://<ECS_IP>:3000`**. 폰은 HTTPS.  
- **`project.config.json` 의 `appid`** 와 백엔드 `.env` 의 WeChat AppID 가 같은小程序 인지 확인.

### 6.3 개발자도구

**清缓存 → 编译 → 预览** 로 QR 을 새로 찍기.

`wx.request` 에는 저장소에서 **`enableHttp2: false`, `enableQuic: false`** 를 넣어 두었음 (`frontend/services/_utils/wxRequestTransport.js`).

---

## 7. Caddy / HTTP3

`deploy/china-test/Caddyfile` 상단에 **HTTP/3(QUIC) 비활성** global 블록이 있을 수 있습니다. 위챗·일부 회선 이슈 완화용입니다.

정식 도메인 블록 예시는 **`deploy/china-test/caddy-snippet-custom-domain.txt`** 를 복사해 `Caddyfile` 맨 아래에 붙이면 됩니다.

---

## 8. 정식 도메인 (sslip 대신)

**당신이 할 일**

1. 도메인 구매 (阿里云·DNSPod·Cloudflare·해외 등록사 등).  
2. DNS **A 레코드** (예: `api.你的域名.com`) → ECS 공인 IP. `dig +short api.你的域名.com` 으로 전파 확인.  
3. **微信公众平台 → 服务器域名** 에 동일 호스트 등록 (`https://` 없이). web-view(支付宝 등) 쓰면 **业务域名** 도.  
4. (중국 본토 대외 서비스 시) **ICP备案** 요구 여부는 호스팅·정책 문서로 확인.

**레포에서 할 일 (권장: 스크립트)**

1. ECS 에서 (DNS 가 IP 를 가리킨 **후**):

```bash
cd /root/wechat-app-live   # 실제 레포 경로
CUSTOM_DOMAIN=api.你的域名.com bash deploy/china-test/enable-public-domain.sh
cd deploy/china-test && docker compose restart caddy && docker compose logs --tail=40 caddy
```

2. `backend/.env`: `API_PUBLIC_BASE_URL=https://api.你的域名.com` (끝 `/` 없음).  
3. `frontend/config/index.js`: `CLOUD_HTTPS_API_BASE_OVERRIDE = 'https://api.你的域名.com'`.  
4. 미니프로그램 **清缓存 → 编译 → 新预览 QR**.

**수동으로 Caddy 만 넣을 때**: `caddy-snippet-custom-domain.txt` 의 호스트를 바꿔 `Caddyfile` 맨 아래에 붙이고 위와 동일하게 `restart caddy`·`.env`·`OVERRIDE`·公众平台.

---

## 9. git pull 이 서버에서 막힐 때

서버에서 직접 수정한 파일이 있으면 `git pull` 이 거부됩니다.

- `backend/.env`, `backend/data/` 는 먼저 **백업**.  
- 팀 방침에 따라 `stash` / 정리 후 `pull`, 또는 **맥에서 필요한 파일만 `scp`** 로 서버에 복사.

---

## 10. 문제 요약

| 증상 | 조치 |
|------|------|
| Caddy가 Restarting | `docker compose logs caddy` — 보통 호스트 **80** 포트 충돌 |
| 폰만 요청 실패 | 公众平台 호스트 = `apiBaseUrl` 호스트, AppID, **재编译·새 QR** |
| 맥 curl 만 RST | VPN/프록시 끄기. 서버 `curl` 로 판단 |
| sslip 로도 위챗만 안 됨 | **정식 도메인** 전환 권장 |
| **관리자 웹에서 이미지 업로드 후 미리보기 안 됨** | 상품 이미지는 **SQLite `product_media` BLOB** + 공개 **`GET /api/media/product/:id`**. `PUBLIC_UPLOAD_BASE_URL=https://공인호스트` 필수에 가깝게 설정. **微信小程序** 은 **download合法域名** 에도 동일 호스트. **`docker compose up -d --build backend`**. |

---

## 11. 무료 서브도메인 쓰는 법 (유료 도메인 없이)

**개념**: 본인이 산 `example.com` 대신, **무료 DNS 서비스가 주는** `이름.duckdns.org` 같은 호스트를 만들고, **A 레코드를 ECS 공인 IP**로 맞춘 뒤, 지금과 같이 **Caddy + Let’s Encrypt + 公众平台**에 그 호스트만 등록하면 됩니다.

### 11.1 DuckDNS (가장 단순한 편)

1. https://www.duckdns.org 에 GitHub 등으로 로그인.  
2. **Subdomain** 하나 정해서 생성 (예: `myshop` → **`myshop.duckdns.org`**).  
3. **IP**를 ECS 공인 IP로 설정하고 **update** 저장.  
4. 서버에서 (DNS 전파 후):

```bash
CUSTOM_DOMAIN=myshop.duckdns.org bash deploy/china-test/enable-public-domain.sh
cd deploy/china-test && docker compose restart caddy
```

5. `backend/.env`: `API_PUBLIC_BASE_URL=https://myshop.duckdns.org`  
6. `frontend/config/index.js`: `CLOUD_HTTPS_API_BASE_OVERRIDE = 'https://myshop.duckdns.org'`  
7. **微信公众平台 → 服务器域名**에 `myshop.duckdns.org` (스킴 없이).  
8. 小程序 **清缓存 → 编译 → 新预览**.

### 11.2 FreeDNS (afraid.org) 등

- https://freedns.afraid.org 등에서 **다른 사람 도메인 아래 무료 서브도메인**을 받는 방식도 있음.  
- 절차는 동일: **A 레코드 → 공인 IP → Caddy 사이트 블록 → .env / OVERRIDE / 公众平台**.

### 11.3 주의 (위챗·운영)

- **무료 호스트도** 公众平台에 **등록 가능 여부·ICP 요구**는 계정·정책에 따라 다름. 막히면 **유료 1차 도메인**이 더 잘 통과하는 경우가 많음.  
- DuckDNS는 **토큰으로 IP 자동 갱신**을 써 두는 것이 좋음(집 회선처럼 IP가 바뀌면 끊김). **ECS 고정 IP**면 거의 문제 없음.  
- **sslip.io**도 “돈 안 내는 호스트”이지만 **등록사 서브도메인이 아님**; WeChat이 거부하면 **DuckDNS 같은 등록 가능한 호스트**를 시도.

---

## 12. Cloudflare Quick Tunnel (대안)

공인 80/443 이 어려울 때 서버에서:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

출력된 `https://....trycloudflare.com` 을 公众平台 + `CLOUD_HTTPS_API_BASE_OVERRIDE` 에 넣음. 주소는 재시작 시 바뀔 수 있음.

---

## 13. 그 외 (OSS / PostgreSQL)

- OSS·`migrate:oss`·PostgreSQL·기능 체크리스트 등 **예전 긴 배포 문서**는 같은 폴더의 **`CHINA_DEPLOY_GUIDE.archive.md`** (백업본)을 연다.  
- 일상 개발은 **`DEV_GUIDE.md`**.

---

## 14. 재배포 스크립트

레포 루트에서:

```bash
bash deploy/china-test/redeploy.sh
```

끝.
