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

위치를 모를 때:

```bash
find /root -name "docker-compose.yml" 2>/dev/null
```

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

4. 서버에서만 SSL 빠르게 볼 때 (맥 LibreSSL 은 `-brief` 없음):

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

1. 도메인 구매 (阿里云·DNSPod·해외 등록사 등).  
2. DNS **A 레코드** → ECS 공인 IP. 전파 확인.  
3. 위 **服务器域名** 에 새 호스트 등록.  
4. (중국 본토 대외 서비스 시) **ICP备案** 등은 阿里云·정책 문서로 확인.

**레포에서 할 일**

1. `caddy-snippet-custom-domain.txt` 의 `api.example.com` 을 본인 호스트로 바꿔 `Caddyfile` 에 추가.  
2. `docker compose restart caddy`  
3. `CLOUD_HTTPS_API_BASE_OVERRIDE` 에 동일 베이스 URL.  
4. 미니프로그램 재编译·새 QR.

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

## 11. Cloudflare Quick Tunnel (대안)

공인 80/443 이 어려울 때 서버에서:

```bash
cloudflared tunnel --url http://127.0.0.1:8080
```

출력된 `https://....trycloudflare.com` 을 公众平台 + `CLOUD_HTTPS_API_BASE_OVERRIDE` 에 넣음. 주소는 재시작 시 바뀔 수 있음.

---

## 12. 그 외 (OSS / PostgreSQL)

- OSS·`migrate:oss`·PostgreSQL·기능 체크리스트 등 **예전 긴 배포 문서**는 같은 폴더의 **`CHINA_DEPLOY_GUIDE.archive.md`** (백업본)을 연다.  
- 일상 개발은 **`DEV_GUIDE.md`**.

---

## 13. 재배포 스크립트

레포 루트에서:

```bash
bash deploy/china-test/redeploy.sh
```

끝.
