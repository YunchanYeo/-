# EC2 배포 가이드 — `hebibingtest.shop`

이 문서는 **AWS EC2(Amazon Linux 2023)** 에 API·관리자 웹을 올리고, 도메인 **`https://hebibingtest.shop`** 으로 서비스할 때의 순서를 정리합니다.  
인프라 스택: **Docker Compose** + **Caddy**(TLS) + **admin-web(nginx)** + **backend(Node)**. 구성 파일은 `deploy/ec2-al2023/` 입니다.

---

## 0. 전제

- EC2에 SSH 가능(맥에서는 VPN 끄고, 필요 시 Homebrew `ssh` 사용 — `deploy/ec2-al2023/README.md` 상위 대화 요약 참고).
- 보안 그룹: **22, 80, 443** 허용.
- 도메인 **`hebibingtest.shop`** 의 DNS를 이 EC2 공인 IP로 맞출 수 있음.

---

## 1. 서버에 Docker·레포

`deploy/ec2-al2023/README.md` 의 **2)~4)** 를 그대로 진행합니다.

요약:

1. Docker 설치 후 `ec2-user` 를 `docker` 그룹에 넣고 **재로그인**.
2. 레포를 `~/wechat-mini` 등 **ASCII 경로**에 클론.
3. `deploy/ec2-al2023/backend.env.example` 을 참고해 **`backend/.env`** 를 만들거나(레포 루트에서 `cp deploy/ec2-al2023/backend.env.example backend/.env`), 맥의 `backend/.env` 를 서버에 복사.

### `backend/.env` 에서 꼭 맞출 값 (도메인 고정)

| 변수 | 예시 |
|------|------|
| `PUBLIC_UPLOAD_BASE_URL` | `https://hebibingtest.shop` |
| `API_PUBLIC_BASE_URL` | `https://hebibingtest.shop` |
| `WECHAT_PAY_NOTIFY_URL` | `https://hebibingtest.shop/api/wechat-pay/notify` |
| `ALIPAY_NOTIFY_URL` | `https://hebibingtest.shop/api/alipay/notify` |

위챗 `WECHAT_APPID` / `WECHAT_APPSECRET` / 결제 관련 값은 `backend/.env.example` 설명과 동일하게 채웁니다.

---

## 2. 컨테이너 기동

```bash
cd ~/wechat-mini/deploy/ec2-al2023
docker compose up -d --build
```

브라우저에서 `https://hebibingtest.shop` → 관리자 SPA, `https://hebibingtest.shop/api/...` → API.

---

## 3. DNS

도메인 업체 콘솔에서:

- **호스트**: `@` 또는 `hebibingtest.shop` (업체마다 표기 다름)
- **타입**: A
- **값**: EC2 **퍼블릭 IPv4** (Elastic IP 권장)

전파는 수 분~수 시간까지 걸릴 수 있습니다.  
`dig +short hebibingtest.shop A` 로 IP가 맞는지 확인합니다.

---

## 4. 微信公众平台 (小程序)

1. **开发 → 开发管理 → 开发设置 → 服务器域名**
2. **request 合法域名**에 다음 호스트만 등록 (프로토콜·경로 없이):

   `hebibingtest.shop`

3. **uploadFile / downloadFile** 등 쓰는 스킴이 있으면 같은 박스 정책에 맞게 추가.
4. **业务域名**(알ipay web-view 등) 사용 시 동일 콘솔에서 별도 등록.

정책·ICP 등은 [微信官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html) 기준으로 본인이 확인합니다.

---

## 5. 미니프로그램 `frontend/config/runtime.js`

배포 후 **진짜 서버**로 붙이려면 대략 다음처럼 맞춥니다 (주석은 기존 스타일 유지).

- `USE_LOCAL_API` → **`false`**
- `CLOUD_HTTPS_API_BASE` → **`'https://hebibingtest.shop'`**
- 개발자도구만 로컬 API 쓸 때: `LOCAL_API_BASE` / `CLOUD_HTTP_API_BASE` 는 로컬 유지 가능.

이미 `CLOUD_LEGACY_API_ORIGINS` 에 `hebibingtest.shop` 이 있으면 구 URL 정규화에 도움이 됩니다.

저장 후 위챗 개발자도구에서 **清缓存 → 重新编译 → 预览** 까지 하는 것이 안전합니다.

---

## 6. 관리자 웹 (`admin-web`)

동일 도메인 루트에서 SPA가 뜨므로, 운영에서는 보통 **`https://hebibingtest.shop`** 으로 접속합니다.  
빌드 시 `VITE_API_BASE_URL` 은 비워 두어(기본) **같은 호스트의 `/api`** 를 쓰게 했습니다(`docker-compose.yml`).

---

## 7. 데이터 영속성

- SQLite·업로드 파일은 Docker 볼륨 **`backend_data`** → 컨테이너 내 `/app/data` 에 저장됩니다.
- 인스턴스를 **삭제하면** 볼륨도 사라지므로, 중요하면 **주기적 백업**(예: `/var/lib/docker/volumes/...` 덤프 또는 스냅샷)을 계획합니다.

---

## 8. HTTPS·인증서

Caddy가 Let’s Encrypt로 인증서를 자동 갱신합니다.  
실패 시: 80/443 방화벽, DNS A 레코드, `docker compose logs caddy` 를 확인합니다.

---

## 9. 배포 갱신 절차

```bash
cd ~/wechat-mini && git pull
cd deploy/ec2-al2023 && docker compose up -d --build
```

---

## 10. 관련 문서

- `deploy/ec2-al2023/README.md` — Docker 설치·`backend/.env`·기동 명령
- `docs/kr/DEPLOY_CN_WECHAT.md` — 위챗 도메인·결제·OSS 등 일반 배포 참고
- `backend/certs/wechat-pay/README.md` — 위챗 결제 PEM (서버 파일 배치)

---

## 11. 흔한 문제

| 증상 | 확인 |
|------|------|
| `docker: 'compose' is not a docker command` | AL2023 에서 `dnf install docker-compose-plugin` 가 없을 수 있음 → **`deploy/ec2-al2023/README.md` §2** 의 GitHub 바이너리 설치 |
| `compose build requires buildx 0.17 or later` | 패키지 Docker 의 buildx 가 구버전 → **`deploy/ec2-al2023/README.md` §2b** Buildx 플러그인 설치 후 다시 `docker compose up -d --build` |
| `https://hebibingtest.shop` 연결 안 됨 | DNS A, 보안 그룹 443, `docker compose ps` |
| TLS 발급 실패 | 80 포트 외부에서 열려 있는지, 도메인이 이 서버 IP를 가리키는지 |
| 小程序 `request:fail` | 合法域名에 `hebibingtest.shop` 등록, `runtime.js` 의 `CLOUD_HTTPS_API_BASE`, 캐시 삭제 후 재빌드 |
| SSH만 안 됨 | VPN 끄기, `deploy/README.md` / 상위 EC2 트러블슈팅 참고 |
