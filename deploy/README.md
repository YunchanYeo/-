# 배포 (`deploy/`)

이 저장소에 포함되어 있던 **알리바바 ECS 전용** 스택(`deploy/china-test/`: Caddy·compose·rsync 스크립트 등)은 **제거**되었습니다.

## 로컬 개발

- 백엔드: `cd backend && npm install && npm run dev`
- 관리자: `cd admin-web && npm install && npm run dev`
- 미니프로그램: 위챗 개발자도구에서 `frontend` 디렉터리 열기

## EC2 (Amazon Linux 2023) + `hebibingtest.shop`

- **`deploy/ec2-al2023/`** — `docker-compose.yml` · `Caddyfile` · `backend.env.example` · 서버에서 할 작업 요약 `README.md`
- 전체 체크리스트(微信·DNS·`runtime.js`): **`docs/kr/DEPLOY_EC2_HEBIBINGTEST.md`**

## 자체 서버에 올릴 때 (일반)

- `backend/Dockerfile`, `admin-web/Dockerfile` 은 그대로 두었으므로, **본인 VPS**에서 `docker compose` 파일을 직접 작성해 `backend`·`admin-web` 이미지를 빌드하거나, 위 EC2 번들을 참고해 수정하면 됩니다.
- TLS(Caddy/nginx)·도메인·비안(ICP) 등은 **호스팅 환경**에 맞게 별도 구성합니다.
- 위챗 **合法域名**·API 베이스는 `docs/kr/DEPLOY_CN_WECHAT.md` 와 `frontend/config/runtime.js` 를 참고하세요.
