# ECS 서버 경로·코드 반영 절차 (에이전트·운영 공용)

본 문서는 **현재 운영 중인 Alibaba Cloud ECS** 기준으로 정리되었다. 서버를 바꾸면 아래 **경로 상수**만 갱신하면 된다.

---

## 1. 경로 상수 (에이전트는 이 값을 기본으로 사용)

| 이름 | 경로 | 설명 |
|------|------|------|
| `ECS_SSH` | `root@39.106.213.185` | SSH 접속 (맥 `deploy/china-test/push-from-mac.sh` 의 `ECS_SSH` 기본값과 동일) |
| `ECS_REPO_ROOT` | `/root/wechat-app` | **`git pull` 하는 쪽**. `.git` 존재. |
| `ECS_LIVE_ROOT` | `/root/wechat-app-live` | **Docker Compose 가 읽는 쪽**. `.git` 없음 (복사본 트리). |
| `ECS_COMPOSE_DIR` | `/root/wechat-app-live/deploy/china-test` | `docker compose up -d --build` 실행 디렉터리. |

백업본 등으로 **`wechat-app-live` 외 경로**를 쓰는 경우가 있으면, 실제 compose 위치는 다음으로 확인한다.

```bash
docker inspect wechat-backend --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'
```

---

## 2. 왜 `git pull` 이 두 경로로 나뉘는지

- 운영 디렉터리 **`ECS_LIVE_ROOT`** 는 예전에 **Git 없이** 복사·배포된 적이 있어 **`git pull` 불가**할 수 있다.
- **`ECS_REPO_ROOT`** 는 Git 클론이 있으므로 **`git pull origin main`** 으로 최신을 받는다.
- 이후 **`ECS_REPO_ROOT` → `ECS_LIVE_ROOT`** 로 소스를 맞춘 뒤, **`ECS_COMPOSE_DIR`** 에서 이미지를 다시 빌드한다.

---

## 3. 최신 `main` 반영 절차 (서버에서 실행)

```bash
ssh root@39.106.213.185

cd /root/wechat-app
git checkout main
git pull origin main

rsync -a \
  --exclude '.env' \
  --exclude 'data' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  /root/wechat-app/backend/ /root/wechat-app-live/backend/

rsync -a /root/wechat-app/deploy/china-test/ /root/wechat-app-live/deploy/china-test/

# 아래 한 덩어리는 **한 줄로 이어져도** `admin-web/cd` 오타가 나지 않도록 `&&` 로 연결함.
rsync -a \
  --exclude 'node_modules' \
  --exclude 'dist' \
  /root/wechat-app/admin-web/ /root/wechat-app-live/admin-web/ && \
cd /root/wechat-app-live/deploy/china-test && \
docker compose up -d --build
```

**컨테이너 상태 확인**은 위 블록이 **끝난 뒤** 프롬프트가 다시 나온 다음, **아래만 따로** 실행한다. (`docker compose ps` 바로 뒤에 `rsync` 등을 붙이면 셸이 `psrsync` 로 합쳐 `unknown docker command: "compose psrsync"` 가 난다.)

```bash
cd /root/wechat-app-live/deploy/china-test
docker compose ps
```

**주의:** `docker compose` 는 **`docker-compose.yml` 이 있는 디렉터리**에서만 동작한다. 반드시 위처럼 **`cd /root/wechat-app-live/deploy/china-test` 이후** 실행할 것. `/root/wechat-app` 에서 실행하면 `no configuration file provided` 가 난다.

**한 블록 복사(SSH 접속 후):** 첫 번째 코드펜스만 붙여넣으면 `git pull` → rsync 3회 → compose 디렉터리 이동 → `docker compose up -d --build` 까지 실행된다. 상태는 두 번째 펜스로 확인.

- **`backend/.env`**, **`backend/data/`** 는 운영 비밀·DB이므로 **rsync 제외** 유지.
- `rsync` 미설치 시: `yum install -y rsync` 또는 `apt-get install -y rsync`.
- **`.env`만 바꾼 경우**: `docker compose up -d --no-deps --force-recreate backend` (자세한 이유는 `DEPLOY_CN_WECHAT.md` §5.1).

---

## 4. 맥에서 일부만 올릴 때

- **`deploy/china-test` + `backend/.env`**: 레포 루트에서 `bash deploy/china-test/push-from-mac.sh`  
  - 환경변수: `ECS_SSH`, `ECS_DEST`(기본 `/root/wechat-app-live`).  
  - **백엔드 TS 전체 동기화는 하지 않음** — 코드 반영은 §3 또는 `ECS_REPO_ROOT` 에서 `pull` 후 rsync.

---

## 5. 문서·스크립트 교차 참조

- 통합 배포 가이드: `docs/kr/DEPLOY_CN_WECHAT.md`
- 위챗페이 인증서·`probe:wechat-pay`: `backend/certs/wechat-pay/README.md`
- 미니프로그램용 HTTPS 호스트 일괄 점검: `deploy/china-test/check-mp-https-hosts.sh` (내부에서 `check-ssl.sh` 호출)
- **tdesign `miniprogram_npm` + 루트 `/` 경로 보정**: 레포 루트에서 **`npm install`**(루트에 `miniprogram-build-npm` devDependency) 후 **`npm run miniprogram:npm`** — `scripts/build-miniprogram-npm.js` 가 `frontend` 에 `npm install --omit=dev` → 루트의 `miniprogram-build-npm` 으로 빌드 → `link-miniprogram-npm-to-root.js`. **`miniprogram-build-npm` 은 `frontend/node_modules` 에 두지 않음**(개발자 도구가 `frontend/miniprogram-build-npm/index.js` 를 찾다 ENOENT 나는 문제 방지). **`/pages`·`/miniprogram_npm` 등만 깨질 때** 빌드 없이 `npm run miniprogram:link` 만 실행(심볼릭 링크: `miniprogram_npm`、`components`、`pages`、`custom-tab-bar`、`assets`). 링크·`miniprogram_npm` 은 `.gitignore` 로 커밋 제외.

---

## 6. 微信小程序真机预览 — 合法域名·TLS·`/api/health`·AppID (운영 체크)

아래는 **코드로 대체 불가**한 위챗 백오피스 작업과, **서버에서 바로 확인**할 수 있는 항목이다. IP·도메인을 바꾸면 `deploy/china-test/Caddyfile`·`frontend/config/runtime.js`·본 절의 호스트 목록을 같이 맞춘다.

### 6.1 `request合法域名` 등록 (https://mp.weixin.qq.com)

1. **로그인** → 지금 미리보기·업로드에 쓰는 **同一个小程序** 선택.
2. **开发 → 开发管理 → 开发设置 → 服务器域名** → **修改** (월 변경 횟수 제한 있음).
3. **request合法域名**에 아래 **호스트만** 등록한다. (저장되는 값은 위챗 규칙상 **도메인·호스트 한 덩어리**이며, 포트·경로 없음.)
   - 백오피스 입력란 **앞쪽에 `https://` 가 고정으로 보이는 경우**가 많다. 이 경우 **`https://` 는 다시 치지 않고**, 그 뒤에 `hebibingtest.shop` 처럼 **호스트만** 넣으면 된다. (화면에 접두사가 “무조건” 보이는 것은 UI일 뿐, **중복으로 `https://https://` 를 넣지 말 것**.)
   - 일부 화면에서는 한 줄에 전체를 입력하게 되어 있어도, 최종적으로 **合法域名 목록에는 호스트**(및 필요 시 경로 없음) 형태로 잡히는지 저장 후 목록을 다시 확인한다.

| 등록할 호스트 (현재 Caddyfile·`runtime.js` 기준) |
|-----------------------------------------------|
| `hebibingtest.shop` |
| `39-106-213-185.sslip.io` |
| `39.106.213.185.nip.io`（**可选** — 仅当 Caddy 使用该主机且已在 mp 登记；同时把 `frontend/config/runtime.js` 内 `PHONE_PROBE_INCLUDE_AUTO_NIP` 设为 `true`） |

- 실제로 미니프로그램이 요청하지 않는 호스트는 생략 가능하나, `app.js` **真机**은 `getPhoneHttpsProbeBases()` 로 **主域名·sslip**（및 `PHONE_PROBE_INCLUDE_AUTO_NIP === true` 일 때만 nip）을 순차 프로브한다. **프로브에 넣은 호스트는 request/upload/download 모두 mp 后台와 일치**해야 한다.
- 상품 이미지 등 **download** 가 동일 호스트면 **download合法域名**에도 동일 호스트 추가 (`docs/kr/DEPLOY_CN_WECHAT.md` §6 참고).
- **upload合法域名**: `open-type="chooseAvatar"`·客服 등에서 **`wx.uploadFile` → `/api/support/upload-media`** 를 쓰므로, **request合法域名**과 **동일한 API 호스트**를 **upload合法域名**에도 등록한다. 공식상 `wx.uploadFile` 의 `filePath` 는 **로컬 경로만** 허용되므로, 개발자 도구의 `http://tmp/...` 는 앱에서 `wx.getImageInfo` 등으로 **실제 temp 경로**로 바꾼 뒤 업로드한다(그대로내면 빈 파일 → `Invalid upload body`).
- **微信头像 URL**(`*.qlogo.cn` 등): 서버가 로그인·`PUT /api/me` 시 **동일 API 根域**으로 BLOB 转存 후 `users.avatarUrl` 을 `/api/media/user-avatar/:userId` 로 바꿈 — **download合法域名**에 `qlogo.cn` 을 넣지 않아도 마이페이지 `<image>` 가 뜨게 하려면 **본 백엔드 배포 후** 사용자가 **다시 로그인**하거나 프로필을 한 번 저장하면 된다.

### 6.2 HTTPS·인증서·`/api/health` = 200

- **아키텍처**: `443` → Caddy(TLS) → `admin-web:80`(nginx) → 경로 `/api/` 는 `backend:3000` (`admin-web/nginx.conf` 의 `proxy_pass`).
- **ECS** (`ECS_COMPOSE_DIR` 또는 동일 compose 디렉터리):

```bash
cd /root/wechat-app-live/deploy/china-test   # 실제 경로는 §1 표 참고
bash check-mp-https-hosts.sh
```

- 기대: 각 호스트마다 `curl` **http_code=200**, 응답 본문에 백엔드 헬스 JSON(예: `ok` 필드)이 보인다. 실패 시 `docker compose logs --tail=80 caddy`·`docker compose ps`·보안그룹 **80·443** 인바운드 확인.
- **真机 vConsole `request:fail -101` / `ERR_CONNECTION_RESET`**: 合法域名과 무관하게 **TCP/TLS 가 중간에서 끊김**(해외→국내 ECS·일부 运营商·HTTP/2 이슈 등). 클라이언트는 동일 URL **재시도·프로브 다회**로 완화(`app.js` / `runtime.js` / `http.js`). 근본적으로는 **同国/同网段 테스트**、**CDN 前置**、**安全组·Caddy 443** 점검을 권장한다.

### 6.3 같은 AppID로 미리보기

- 레포 `project.config.json` 의 **`appid`** = 위챗 백오피스에서 연 **小程序 AppID** = `backend/.env` 의 **`WECHAT_APPID`** 가 같아야 한다. 다르면 **真机**만 도메인·토큰 불일치로 실패하는 경우가 많다. (저장소 기본값 예: `wxdd12341e879d5d6b` — 실제 운영 AppID 와 다르면 파일·`.env` 를 맞출 것.)
- 개발자도구: **清缓存 → 编译 → 预览** 로 QR 을 새로 찍는다.

### 6.4 코드·배포 경로

- API 베이스·폰 프로브 순서: **`frontend/config/runtime.js`** (`CLOUD_HTTPS_API_BASE` 등).
- 상세 배포 루프: 본 문서 **§3** 및 `docs/kr/DEPLOY_CN_WECHAT.md`.

---

## 7. 서버를 갈아엎을 때 (선택)

장기적으로 **`ECS_LIVE_ROOT` 를 `git clone` 으로 다시 만들고** compose 만 그 트리를 쓰면, §3 의 rsync 단계 없이 `git pull` 한 곳에서 빌드할 수 있다. 전환 시 `.env`·`data` 백업 필수.

---

**에이전트 지시:** 사용자가「서버에 반영」「ECS 배포」「git pull 서버」등을 요청하면 **먼저 본 파일을 열어** 위 표의 경로와 §3 명령을 사용한다. SSH 호스트·`ECS_DEST`가 바뀌었다면 사용자에게 문서 갱신을 요청한다.
