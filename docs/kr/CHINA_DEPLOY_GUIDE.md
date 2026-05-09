# 중국(阿里云) 테스트 서버 배포 가이드

## 1) 목표

- ECS에 테스트 환경을 배포해 실제 기능 점검
- 미디어(이미지/음성)는 OSS 사용 가능
- 데이터는 현재 SQLite 런타임 + PostgreSQL 이관 스크립트 병행

---

## 2) 사전 준비 (필수)

- 阿里云 계정
- ECS(중국 리전 권장: 서울보다 중국 사용자 지연이 낮음)
- OSS 버킷 (ECS와 같은 리전 권장)
- (선택) RDS PostgreSQL 인스턴스
- 도메인 + HTTPS 인증서

### 중국 서비스 필수 참고

- 퍼블릭 서비스 도메인을 중국 본토에서 운영하려면 **ICP备案**이 필요할 수 있음
- 테스트 단계는 임시 도메인/공인 IP로 검증 가능하지만, 운영 전备案 정책 확인 권장

---

## 3) 서버 오픈 포트 / 보안그룹

- 22 (SSH)
- 80 (HTTP)
- 443 (HTTPS, SSL 적용 시)
- 8080 (관리자 웹 임시 점검용, 운영 시 80/443 뒤로 숨김 권장)
- 3000 (백엔드 직접 점검용, 운영 시 내부망/프록시 뒤로 제한 권장)

---

## 4) 서버 설치

```bash
sudo apt update
sudo apt install -y git ca-certificates curl
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# 재로그인 후
docker --version
docker compose version
```

---

## 5) 프로젝트 배포

```bash
git clone <your-repo-url>
cd "微信小程序"
```

### 5-1) 백엔드 환경변수 설정

`backend/.env`에 최소 아래 값 설정:

- WeChat/관리자 계정
- `MEDIA_PROVIDER=aliyun-oss` (OSS 사용 시)
- `OSS_REGION`
- `OSS_BUCKET`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `OSS_PUBLIC_BASE_URL` (권장, CDN/커스텀 도메인)

> 보안상 `OSS_ACCESS_KEY_SECRET`, 관리자 비밀번호, API 키는 절대 저장소에 커밋하지 마세요.

### 5-2) 컨테이너 실행

```bash
cd deploy/china-test
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

접속:

- 관리자 웹: `http://<ECS_IP>:8080`
- 백엔드 헬스: `http://<ECS_IP>:3000/api/health`

### 5-3) 微信小程序 — 真机预览(QR)에서 API 연결되게 하기

**개발자도구 시뮬레이터 연결 복구**: 저장소 기본은 `CLOUD_USE_HTTPS_NIP = false` (`http://<ECS_IP>:3000`). HTTPS(sslip) 가 브라우저에서도 안 열리면 **절대 true 로 두지 말 것** — 시뮬레이터까지 전부 끊김. 에디터 **详情 → 本地设置 → 不校验合法域名…** 체크 확인.

**폰만 안 될 때**: 위챗은 실기에서 **HTTPS + 服务器域名 등록**을 요구하는 경우가 많음. `CLOUD_USE_HTTPS_NIP = true` 는 **sslip HTTPS 가 서버에서 실제로 열린 뒤**에만 켜고, 微信公众平台에 같은 호스트 등록. 그 전까지는 시뮬레이터만으로 테스트하거나 Cloudflare Tunnel 등으로 확실한 HTTPS URL 확보.

시뮬레이터와 달리 **폰 프리뷰**는 **HTTPS + `request合法域名` 등록**이 필요한 경우가 많습니다. **sslip.io** / **nip.io**(IP→도메인) + **Caddy**(Let’s Encrypt) 조합을 씁니다. 저장소 기본은 **sslip.io** (`39-106-213-185.sslip.io` 형식, IP 바뀌면 하이픈 호스트도 수정).

1. **경량 서버 방화벽**: TCP **80**, **443** 인바운드 허용.
2. **`deploy/china-test/Caddyfile`**: 공인 IP에 맞는 **sslip**·**nip** 호스트인지 확인.
3. **컨테이너 기동**(현재 `docker-compose.yml` 에서 **Caddy가 프로필 없이 포함**됨 — `docker compose up -d` 만 하면 HTTPS 종단도 같이 올라감):

```bash
cd deploy/china-test
docker compose up -d
docker compose ps
docker compose logs --tail=80 caddy
```

4. **먼저 백엔드만 확인**(링크가 안 열릴 때): `http://<ECS_IP>:3000/api/health` — 여기도 안 되면 Docker·경량 서버 **방화벽 3000** 부터.
5. **HTTPS 확인**: PC 브라우저에서 `https://39-106-213-185.sslip.io/api/health` (IP에 맞게 호스트 수정). **IPv6 때문에 안 될 때** 는 터미널에서 `curl -4sv https://39-106-213-185.sslip.io/api/health` 로 테스트.
6. **HTTPS 가 계속 안 될 때 (순서대로)**  
   - `docker ps` 에 **`wechat-caddy`** 가 **Up** 인지 (`Restarting` 이면 `docker logs wechat-caddy` 에 포트 충돌·인증서 에러 확인).  
   - 경량 서버 **방화벽·보안조** 에 **80·443 TCP 인바운드** 허용했는지.  
   - 서버 호스트에 **nginx/httpd** 가 이미 **80** 을 쓰면 Caddy가 못 뜸 → `systemctl stop nginx` 등으로 비우거나 Caddy만 쓰도록 조정.  
   - 서버 안에서: `ss -tlnp | grep -E ':80|:443'` 로 리슨 확인.
7. **微信公众平台** → **服务器域名**: **request合法域名**·필요 시 **download合法域名**에 `39-106-213-185.sslip.io` 처럼 **스킴 없이 호스트만**.
8. **`frontend/config/index.js`** 의 `CLOUD_HTTPS_API_BASE` 와 Caddyfile·백오피스 도메인을 **동일 호스트**로 맞춘 뒤 미니프로그램 재컴파일.

**Let's Encrypt / sslip 가 서버에서 계속 실패할 때 (대안)**

서버에 **공인 80·443 을 열기 어렵거나** ACME 가 막히면, **Cloudflare Quick Tunnel** 로 임시 **HTTPS URL** 을 받을 수 있습니다(출력되는 `https://….trycloudflare.com` → 미니프로그램 `CLOUD_HTTPS_API_BASE`·公众平台 도메인에 넣기). 예:

```bash
# 예: amd64 리눅스 — 공식 릴리스 바이너리 확인 후 설치
curl -fsSL -o /usr/local/bin/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x /usr/local/bin/cloudflared
cloudflared tunnel --url http://127.0.0.1:8080
```

(`8080` 은 nginx 관리자 웹 컨테이너가 호스트에 연 포트. 백엔드만 두면 `3000`.)

**폰만 연결 안 될 때 체크**

1. `CLOUD_USE_HTTPS_NIP = true` 인지 확인.  
2. `docker compose up -d` 후 **`wechat-caddy` Up**·**caddy 로그**에 에러 없는지.  
3. 방화벽 **80·443**, 브라우저/`curl -4` 로 **HTTPS 헬스** 확인.  
4. **服务器域名** 호스트 = 미니프로그램 `apiBaseUrl` 호스트.  
5. Caddy 없이 평소처럼만 쓰려면: `docker stop wechat-caddy` 후 시뮬레이터용으로 `CLOUD_USE_HTTPS_NIP = false` (`http://IP:3000`).

### 5-4) 폰 실기 연결 — 초보용 (왜 시뮬레이터만 되나 / 두 가지 방법)

**왜 PC 시뮬레이터는 되는데 폰은 안 되나**

- 시뮬레이터는 `http://공인IP:3000` 으로 요청해도, 에디터에서 **「不校验合法域名」** 을 켜 두면 테스트가 된다.
- **실제 폰의 위챗 앱**은 보통 **HTTPS** 만 허용하고, 요청 주소가 **微信公众平台에 등록된 도메인**과 맞아야 한다. 그래서 HTTP·IP만으로는 폰이 막히는 경우가 많다.

아래 **방법 A** 또는 **방법 B** 중 하나만 끝까지 하면 된다.

---

#### 방법 A — 서버에 HTTPS(sslip) 직접 열기 (고정 IP 유지 시 추천)

**준비물**: 阿里云 서버 공인 IP, `deploy/china-test` 최신 파일(Caddyfile·docker-compose).

1. **방화벽**  
   경량 서버 콘솔 → 방화벽/보안조 → 인바운드에 **TCP 80**, **TCP 443**, **TCP 3000**(점검용) 허용.

2. **호스트 이름 맞추기**  
   IP가 예를 들어 `39.106.213.185` 이면 sslip 호스트는 **`39-106-213-185.sslip.io`** (점을 하이픈으로).  
   `deploy/china-test/Caddyfile` 의 블록 이름과 **`frontend/config/index.js`** 의 `CLOUD_HTTPS_API_BASE` 가 **같은 호스트**인지 확인. IP가 바뀌면 둘 다 수정.

3. **Docker 전부 기동**  
   서버 SSH에서:

   ```bash
   cd /root/wechat-app-live/deploy/china-test
   docker compose up -d
   docker ps | grep caddy
   ```

   `wechat-caddy` 가 **Up** 이어야 한다. `Restarting` 이면 `docker logs wechat-caddy` 로 에러 확인 (대개 **80 포트 충돌**: 호스트 nginx 중지 등).

4. **브라우저로 HTTPS 확인**  
   PC에서 `https://39-106-213-185.sslip.io/api/health` 열기 (본인 IP에 맞게).  
   안 되면 서버에서 `curl -4sv https://39-106-213-185.sslip.io/api/health` 로 확인.

5. **微信公众平台 등록**  
   [mp.weixin.qq.com](https://mp.weixin.qq.com/) 로그인 → **开发** → **开发管理** → **开发设置** → **服务器域名**  
   - **request合法域名**: `39-106-213-185.sslip.io` (**https:// 없이**, 경로 없이)  
   - 상품 이미지·채팅 파일이 같은 주소에서 나오면 **download合法域名**에도 동일 호스트 추가.

6. **미니프로그램 코드**  
   `frontend/config/index.js` 에서 **`CLOUD_USE_HTTPS_NIP = true`** 로 바꾸고, `CLOUD_HTTPS_API_BASE` 가 위와 동일한 `https://…sslip.io` 인지 확인 → 저장 후 개발자도구 **컴파일** → 폰에서 **프리뷰 QR** 다시 스캔.

---

#### 방법 B — Cloudflare Tunnel (서버에서 80/443·sslip 가 안 될 때)

원리: 서버가 Cloudflare로 **아웃바운드 연결**만 하면, Cloudflare가 **`https://xxxx.trycloudflare.com`** 같은 주소를 준다. 방화벽 인바운드 80/443 없어도 되는 경우가 많다.

1. 서버(阿里云) SSH 접속.

2. **cloudflared 설치** (아키텍처 맞는 바이너리 — 예: amd64):

   ```bash
   curl -fsSL -o /usr/local/bin/cloudflared \
     https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
   chmod +x /usr/local/bin/cloudflared
   ```

3. **터널 실행** (관리 웹+API 한 번에 쓰려면 nginx 컨테이너 포트인 **8080** 권장 — `/api` 는 nginx가 백엔드로 넘김):

   ```bash
   cloudflared tunnel --url http://127.0.0.1:8080
   ```

   터미널에 **`https://xxxxx.trycloudflare.com`** 가 출력된다. **이 창을 끄면 주소가 바뀔 수 있음**(Quick Tunnel 특성).

4. **微信公众平台** → **服务器域名** → **request合法域名** 에 **`xxxxx.trycloudflare.com`** 만 등록 (앞의 `https://` 제외).

5. **미니프로그램**  
   `CLOUD_USE_HTTPS_NIP = true` 로 두고, **`CLOUD_HTTPS_API_BASE`** 를 출력된 주소와 동일하게 설정:

   ```js
   const CLOUD_HTTPS_API_BASE = 'https://xxxxx.trycloudflare.com';
   ```

   저장 → 컴파일 → 폰 프리뷰.

**참고**: Quick Tunnel URL은 재시작마다 바뀔 수 있어서, 매번 公众平台·코드를 맞춰야 할 수 있다. 고정이 필요하면 Cloudflare **Named Tunnel** 문서를 따른다.

---

#### 실패할 때만 체크

| 증상 | 볼 곳 |
|------|--------|
| 시뮬레이터도 안 됨 | `CLOUD_USE_HTTPS_NIP = false` 로 두고 `http://IP:3000` 으로 복구 |
| HTTPS 페이지만 안 열림 | Caddy 로그, 방화벽 80·443, 호스트 80 포트 충돌 |
| 폰만 여전히 안 됨 | 公众平台 도메인과 `apiBaseUrl` 호스트가 **완전히 동일한지**(대소문자·오타) |

---

## 6) OSS 전환/이관

### 6-1) 신규 업로드 바로 OSS로 저장

- `MEDIA_PROVIDER=aliyun-oss`면 신규 이미지/음성은 OSS로 저장

### 6-2) 기존 로컬 업로드 이관

```bash
cd backend
npm install
npm run migrate:oss
```

- 로컬 `backend/data/uploads` 파일을 OSS로 업로드
- DB의 `products.image`, `support_messages.content` URL 치환

---

## 7) PostgreSQL 이관 테스트 (선택)

RDS 사용 시:

- `backend/.env`에 `POSTGRES_URL=postgres://...` 설정

```bash
cd backend
npm install
npm run migrate:pg
```

주의:

- 현재 스크립트는 **초기 전체 이관용** (대상 테이블 TRUNCATE 후 적재)
- 운영 무중단 전환은 별도 전략(CDC/듀얼라이트) 필요

---

## 8) 기능 테스트 체크리스트

1. 관리자 주문 탭에서 주소/상품 상세 확인
2. 사용자 고객센터에서 주문 선택 후 문의 전송
3. 관리자(미니/React) 채팅에서 주문 태그 노출 확인
4. React 관리자에서 주문 태그 클릭 시 주문관리 점프/상세 오픈 확인
5. 이미지/음성 업로드 URL이 OSS 도메인인지 확인
6. 물류조회/주문상태 변경/재고 변경 정상 여부 확인

---

## 9) 운영 전 권장

- Nginx(80/443) 앞단 구성, 8080/3000 외부 노출 최소화
- HTTPS 강제, HSTS 적용
- RDS/OSS/ECS를 동일 리전에 배치
- 백업 정책:
  - SQLite 사용 시 `data/app.sqlite` + `data/uploads` 주기 백업
  - PostgreSQL 사용 시 스냅샷 + PITR
- 모니터링:
  - 컨테이너 로그 수집
  - 5xx 비율 / 업로드 실패율 / 응답시간 추적

