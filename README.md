# WeChat 미니프로그램 쇼핑 프로젝트 문서

이 저장소는 **미니프로그램(`frontend`) + Node/Express API(`backend`) + PC 관리자 웹(`admin-web`)**으로 구성된 쇼핑·관리 예제입니다.  
이 문서는 구조, 실행 방법, API, 운영 포인트를 한 번에 정리합니다.

## 1) 프로젝트 한눈에 보기

- **사용자(미니)**: 상품 탐색/검색, 장바구니, 주문/환불, 주소, 고객센터 채팅 등
- **관리자(미니 또는 PC 웹 동일 백엔드)**: 로그인, 상품·재고·분류, 주문/발송, 고객센터 채팅 등
- **프런트(미니)**: WeChat Mini Program(JavaScript), TDesign MiniProgram
- **프런트(PC)**: React + TypeScript + Vite（`admin-web`）
- **백엔드**: Express(TypeScript), SQLite(`better-sqlite3`), `zod`, `bcrypt`

핵심 데이터 흐름:

```text
Mini Program admin-web ──► /api/* ──► Service Layer ──► SQLite(backend/data/app.sqlite)
```

## 2) 저장소 구조

```text
.
├─ frontend/                    # WeChat 미니프로그램
│  ├─ app.js / app.json
│  ├─ config/index.js           # apiBaseUrl, useMock
│  ├─ pages/                    # 페이지·관리자( admin/* )·고객센터 등
│  ├─ services/                 # 도메인 API 래퍼 (admin: services/admin/session.js 등)
│  ├─ custom-tab-bar/
│  └─ docs/FRONTEND_SDK.md
│
├─ admin-web/                   # PC용 관리자 SPA (Vite + React + TS)
│  ├─ src/pages/               # 로그인, 상품, 주문, 분류, 고객센터 등
│  ├─ src/api/                 # 같은 /api/admin/* 호출(x-admin-token)
│  ├─ vite.config.ts           # 개발 시 /api·/uploads 프록시 → 백엔드
│  └─ package.json
│
├─ backend/
│  ├─ src/
│  │  ├─ index.ts              # Express 부트, CORS, /api, /uploads 정적
│  │  ├─ adminBootstrap.ts      # 초기 admins 없을 때·ADMIN_SYNC_ON_START 등
│  │  ├─ db.ts                 # SQLite DDL/마이그레이션
│  │  ├─ routes/apiRouter.ts
│  │  ├─ controllers/
│  │  └─ services/             # 상품·주문·카테고리·관리자·support·물류 등
│  ├─ src/scripts/seedAdmin.ts # .env ADMIN_*로 admins bcrypt 시드
│  └─ data/
│     ├─ app.sqlite
│     └─ uploads/
│
├─ mock.md
└─ README.md                     # 본 문서
```

## 3) 빠른 시작

### 3.1 백엔드 실행

```bash
cd backend
npm install
npm run dev
```

정상 로그: `[backend] listening on http://127.0.0.1:3000`  
헬스: `GET http://127.0.0.1:3000/api/health`

### 3.2 관리자 계정(DB 반영 · 필수)

관리자 **로그인 검증은 SQLite `admins` 테이블**의 `passwordHash`(bcrypt) 또는 초기 레거시 평문 `password`입니다.  
**.env 문자열만 맞춰 놓으면 안 되며**, 다음으로 DB에 비밀번호 해시를 넣어야 합니다.

1. `backend/.env` 예시 (`backend/.env.example` 참고):

```env
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password
WECHAT_APPID=your-app-id
WECHAT_APPSECRET=your-app-secret
WECHAT_PAY_MOCK=true
```

1. 시드 실행(같은 username이 있으면 비밀번호 해시를 갱신):

```bash
cd backend
npm run seed:admin
```

선택: `ADMIN_SYNC_ON_START=true` 로 서버 기동 시 위 `ADMIN_USERNAME` 행 비밀번호를 `.env`와 동기화(운영에서는 보통 `false`).

### 3.3 미니프로그램

1. WeChat 개발자도구에서 **프로젝트 디렉터리를 `frontend`** 로 연다.
2. `frontend/config/index.js`:

```js
useMock: false,
apiBaseUrl: 'http://127.0.0.1:3000',
```

- 실제 기기 테스트 시에는 PC와 같은 네트워크에서 접근 가능한 호스트/IP로 변경하고, 미니 프로그램 **request合法域名·不校验HTTPS(개발)** 설정을 맞춘다.

### 3.4 PC 관리자(admin-web)

```bash
cd admin-web
npm install
npm run dev
```

브라우저에서 `**http://localhost:5174**` (기본 포트는 `vite.config.ts`에서 정의).  
API는 동일하게 `backend`를 바라본다 — 개발 시 `vite` 프록시로 `/api`·`/uploads`가 넘어가도록 두었다.  
운영에서는 `npm run build` 후 `dist` 정적 호스팅하고, 빌드 시 `VITE_API_BASE_URL`(백엔드 원점 URL) 설정이 필요할 수 있다.

#### Electron 데스크톱 앱

```bash
cd admin-web
npm install
npm run desktop:dev
```

- `desktop:dev`는 Vite + Electron을 같이 실행한다(현재 기본 포트 `5180`).
- `desktop:build`는 DMG를 생성한다:

```bash
cd admin-web
npm run desktop:build
```

- 결과물 경로: `admin-web/release/Admin Web-1.0.0-arm64.dmg`
- 데스크톱 앱도 API는 `backend`를 사용한다. (프로젝트 내부 실행 시 Electron이 backend를 자동 기동 시도)

## 4) 프런트엔드 구성 포인트

### 미니(`frontend`)

- 라우팅: `frontend/app.json`의 `pages` / 서브패키지
- 탭바: `frontend/custom-tab-bar/*`
- 공통 요청: `frontend/services/_utils/http.js`
- 사용자 세션: `frontend/services/auth/session.js`
- **관리자 세션/API**: `frontend/services/admin/session.js`, `frontend/services/admin/adminApi.js`
- 고객센터: `frontend/services/support/chat.js`
- 고객센터 페이지 런타임 공통화: `frontend/services/support/chatPageRuntime.js`
- 마이페이지 부가 화면: `frontend/pages/user/help-center`, `frontend/pages/user/points`

권장: 페이지에서 `wx.request` 대신 `services/`*만 사용.

고객센터 채팅 최신 동작 메모:

- 사용자/관리자 채팅 모두 음성 녹음·재생 제어를 공통 런타임으로 통일해 동작 차이를 줄였다.
- 페이지 전환(`onHide`/`onUnload`) 시 녹음 중이면 자동 중단하여 잔여 녹음 상태를 방지한다.
- 4초 폴링 시 매번 강제 하단 이동하지 않고, 새 메시지 도착 시에만 자동 스크롤한다.

### PC(`admin-web`)

- 라우팅: `admin-web/src/App.tsx`
- 로그인·토큰: `admin-web/src/auth.tsx`, `localStorage`(`admin_web_token`)

## 5) 백엔드 구성 포인트

- 엔트리: `backend/src/index.ts` — `cors()`, JSON, `/uploads` 정적, `/api/*`
- 초기 admins 없음 + `.env`에 `ADMIN_*` 있으면 `adminBootstrap`가 첫 행 생성 등
- DB: `backend/src/db.ts` — WAL, busy_timeout, 스키마·점진적 컬럼 추가

## 6) API 요약

### Public

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products`, `GET /api/products/:id`
- `POST /api/auth/wechat-login`

### User (`requireAuth`)

- `GET/PUT /api/me`
- 주소: `GET/POST/PUT/DELETE /api/addresses`
- 주문: `GET /api/orders`, `GET /api/orders/count`, `GET /api/orders/:orderNo`
- `POST /api/orders/commit`, `POST /api/orders/:orderNo/refund`
- `POST /api/orders/:orderNo/paid` (개발 mock 결제 성공 처리)
- `POST /api/orders/:orderNo/cancel` (대기 결제 주문 취소)
- `POST /api/orders/:orderNo/confirm` (대기 수령 주문 확인 수령)
- `DELETE /api/orders/:orderNo` (완료/취소 주문 삭제)

포인트 규칙:

- 결제 성공 시 `floor(paymentAmount * pointsEarnRatePercent / 100)` 만큼 적립
- 결제 시 보유 포인트가 `pointsUseThreshold` 이상이면 포인트 사용(결제금액 차감) 가능
- 사용 포인트는 주문에 기록되고 결제 성공 시 차감/적립이 함께 반영
- 관리자 설정 페이지에서 적립 비율(%)과 사용 시작 포인트를 변경 가능
- 고객센터: `GET/POST /api/support/messages`, `POST /api/support/upload-media`

### Admin (`requireAdmin`, 헤더 `x-admin-token`)

- `POST /api/admin/login` — `**admins` DB 검증**(bcrypt/레거시 평문 일치 시 해시 업그레이드)
- `GET /api/admin/me`, `PUT /api/admin/me/password`, `PUT /api/admin/me/username`
- 주문: `GET /api/admin/orders`, `POST /api/admin/orders/:orderNo/shipping`
- `GET /api/admin/orders/:orderNo/logistics-trace` — 물류(환경에 따라快递100 등)
- 상품: `GET/POST/PUT /api/admin/products`, `GET /api/admin/products/:id`, `PUT /api/admin/products/:id/stock`
- 업로드: `POST /api/admin/upload-image`
- 분류: `GET/POST/PUT/DELETE /api/admin/categories`
- 优惠券: `GET/POST /api/admin/coupons`, `POST /api/admin/coupons/:id/grant`, `PUT /api/admin/coupons/:id`, `DELETE /api/admin/coupons/:id`
- 고객센터: `GET /api/admin/support/conversations`, `GET /api/admin/support/messages/:userId`, `POST`(답변), `POST /api/admin/support/upload-media`

## 7) 운영 시 주의사항

- 관리자 비밀번호는 `passwordHash` 저장을 권장; 시드/동기화는 `seed:admin` 또는 `ADMIN_SYNC_ON_START`.
- `WECHAT_APPSECRET`, DB 파일, `.env`는 저장소와 프런트에 노출하지 않는다.
- SQLite `database is locked` 시 백엔드 프로세스 중복 여부 확인.
- 미니 개발 시 `apiBaseUrl`/`request 도메인`과 PC `admin-web`의 API 베이스 URL이 **같은 백엔드**인지 확인.

## 8) 관련 문서

- `frontend/docs/FRONTEND_SDK.md`
- `frontend/WECHAT_API_INTEGRATION.md`
- `mock.md`
- `backend/README.md`

