# WeChat 미니프로그램 쇼핑 프로젝트 문서

이 저장소는 **미니프로그램 프론트엔드(`frontend`) + Node/Express 백엔드(`backend`)**로 구성된 쇼핑 서비스 예제입니다.  
이 문서는 프로젝트 전체를 빠르게 파악하고 바로 실행할 수 있도록 구조, 실행, API, 운영 포인트를 한 번에 정리합니다.

## 1) 프로젝트 한눈에 보기

- 사용자 기능: 상품 탐색/검색, 장바구니, 주문/환불, 주소 관리, 고객센터 채팅
- 관리자 기능: 로그인, 상품 관리, 주문 배송 처리, 관리자 계정 변경, 채팅 응대
- 프론트 기술: WeChat Mini Program(JavaScript), TDesign MiniProgram
- 백엔드 기술: Express(TypeScript), SQLite(`better-sqlite3`), `zod`, `bcrypt`

핵심 데이터 흐름:

```text
Page -> Services -> requestJson -> /api/* -> Service Layer -> SQLite
```

## 2) 저장소 구조

```text
.
├─ frontend/
│  ├─ app.js
│  ├─ app.json
│  ├─ config/index.js
│  ├─ pages/
│  ├─ services/
│  ├─ custom-tab-bar/
│  └─ docs/
│
├─ backend/
│  ├─ src/index.ts
│  ├─ src/db.ts
│  ├─ src/routes/apiRouter.ts
│  ├─ src/controllers/apiController.ts
│  ├─ src/services/
│  ├─ src/scripts/seedAdmin.ts
│  └─ data/
│
├─ mock.md
└─ README.md
```

## 3) 빠른 시작

### 3.1 백엔드 실행

```bash
cd backend
npm install
npm run dev
```

정상 로그:

```text
[backend] listening on http://127.0.0.1:3000
```

헬스 체크: `GET http://127.0.0.1:3000/api/health`

### 3.2 관리자 계정 생성(필수)

`backend/.env` 파일 생성 후 아래 값 설정:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password
WECHAT_APPID=your-app-id
WECHAT_APPSECRET=your-app-secret
WECHAT_PAY_MOCK=true
PORT=3000
```

그 다음 실행:

```bash
cd backend
npm run seed:admin
```

### 3.3 미니프로그램 실행

1. WeChat 개발자도구에서 프로젝트 루트를 엽니다.
2. `frontend/config/index.js`에서 아래를 확인합니다.

```js
useMock: false,
apiBaseUrl: 'http://127.0.0.1:3000',
```

3. 컴파일 후 페이지 동작을 확인합니다.

## 4) 프론트엔드 구성 포인트

- 페이지 라우팅: `frontend/app.json`의 `pages` + `subpackages`
- 탭바: `frontend/custom-tab-bar/*`
- 공통 요청 유틸: `frontend/services/_utils/http.js`
- 인증 세션: `frontend/services/auth/session.js`
- 도메인 서비스:
  - 상품: `frontend/services/good/*`
  - 주문: `frontend/services/order/*`
  - 주소: `frontend/services/address/*`
  - 고객센터: `frontend/services/support/chat.js`
  - 쿠폰: `frontend/services/coupon/index.js`

권장 규칙: 페이지에서 `wx.request`를 직접 호출하지 않고, 항상 `services/*`를 통해 API를 접근합니다.

## 5) 백엔드 구성 포인트

- 서버 엔트리: `backend/src/index.ts`
  - `/uploads` 정적 경로 제공
  - `paymentMockMode`/WeChat env 설정 주입
- DB 초기화/마이그레이션: `backend/src/db.ts`
  - `WAL`, `busy_timeout` 설정으로 lock 완화
  - 테이블 자동 생성 + 컬럼 점진적 보강
- 라우트: `backend/src/routes/apiRouter.ts`
- 도메인 서비스: `backend/src/services/*.ts`

## 6) API 요약

### Public

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/auth/wechat-login`

### User Auth

- `GET /api/me`, `PUT /api/me`
- `GET/POST/PUT/DELETE /api/addresses`
- `GET /api/orders`, `GET /api/orders/count`, `GET /api/orders/:orderNo`
- `POST /api/orders/commit`
- `POST /api/orders/:orderNo/refund`
- `GET/POST /api/support/messages`
- `POST /api/support/upload-media`

### Admin

- `POST /api/admin/login`
- `GET /api/admin/me`
- `PUT /api/admin/me/password`
- `PUT /api/admin/me/username`
- `GET /api/admin/orders`
- `POST /api/admin/orders/:orderNo/shipping`
- `GET/POST/PUT /api/admin/products`
- `PUT /api/admin/products/:id/stock`
- `POST /api/admin/upload-image`
- `GET /api/admin/support/conversations`
- `GET/POST /api/admin/support/messages/:userId`
- `POST /api/admin/support/upload-media`

## 7) 운영 시 주의사항

- 관리자 비밀번호는 `passwordHash` 기반으로 저장되며 평문 저장을 지양합니다.
- `WECHAT_APPSECRET`은 절대 프론트에 노출하지 않습니다.
- 로컬 개발에서 API 실패 시 `apiBaseUrl`, 개발자도구 도메인 설정, 백엔드 프로세스 중복 여부를 먼저 점검합니다.
- SQLite lock 에러가 보이면 백엔드 중복 실행 프로세스를 정리하고 단일 인스턴스로 재실행합니다.

## 8) 관련 문서

- 프론트 서비스 계층 가이드: `frontend/docs/FRONTEND_SDK.md`
- WeChat API 연동 가이드: `frontend/WECHAT_API_INTEGRATION.md`
- Mock 운영 가이드: `mock.md`
- 백엔드 상세 가이드: `backend/README.md`


