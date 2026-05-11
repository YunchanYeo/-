# Backend 개발 가이드

언어 / 语言:
- 한국어: `backend/README.md`
- 中文: `backend/README.zh-CN.md`

`backend`는 WeChat 미니프로그램 프론트엔드가 호출하는 API 서버입니다.  
Express + SQLite 기반으로 동작하며, 관리자/사용자 인증과 상품/주문/고객센터 기능을 제공합니다.

## 1. 기술 스택

- Runtime: Node.js
- Server: Express
- Language: TypeScript (ESM)
- DB: SQLite (`better-sqlite3`)
- Validation: `zod`
- Password hash: `bcrypt`

## 2. 실행 방법

```bash
cd backend
npm install
npm run dev
```

기본 포트는 `3000`이며, 헬스 체크는 `GET /api/health`입니다.

`npm run build`는 `backend/dist`에 컴파일 결과를 둔다. 이 디렉터리는 **Git에 포함하지 않으며**(`.gitignore`의 `dist`), 운영에서 `start:dist`를 쓸 때만 로컬/CI에서 빌드하면 된다.

### TypeScript인데 `dist`에 `.js`가 생기는 이유

- **작성·수정하는 소스**는 `src/` 아래의 `.ts` 파일뿐이다.
- **Node.js 런타임은 기본적으로 JavaScript만 실행**한다. 그래서 `tsc`(TypeScript 컴파일러)가 `.ts`를 `.js`로 변환해 `dist/`에 넣는다.
- `dist/`의 JS는 **두 번째 소스 트리가 아니라 빌드 산출물**이다. 평소 개발은 `npm run dev`(tsx로 TS 직접 실행), 배포나 `npm run start:dist`만 할 때 `dist`를 쓰면 된다.

## 3. 환경변수

`.env` 예시:

```env
PORT=3000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password
WECHAT_APPID=your-app-id
WECHAT_APPSECRET=your-app-secret
WECHAT_PAY_MOCK=true
```

설명:

- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: **`npm run seed:admin` 또는 `ADMIN_SYNC_ON_START=true` 시 SQLite `admins`에 bcrypt 해시로 반영**됩니다. 로그인(`POST /api/admin/login`)은 **실제로는 DB 행**(passwordHash 또는 레거시 평문 password)만 검증합니다.
- `ADMIN_SYNC_ON_START=true`: 매 기동 시 위 username 행 비밀번호 해시를 `.env` 값과 동기화(운영에서는 보통 `false`).
- `WECHAT_APPID` / `WECHAT_APPSECRET`: WeChat 로그인 코드 교환
- `WECHAT_PAY_MOCK`: `false`가 아니면 결제 mock. 실결제·商户证书·`WECHAT_PAY_PRIVATE_KEY` PEM 형식·Docker 반영은 **`backend/.env.example`** 및 **`backend/certs/wechat-pay/README.md`** 참고.
- `KUAIDI100_KEY` / `KUAIDI100_CUSTOMER`(선택): 관리자 주문 **물류轨迹** 연동(快递100 등, `.env.example` 참고)

## 4. 관리자 계정 시드

```bash
cd backend
npm run seed:admin
```

- 동일 `username`이 이미 있으면 **비밀번호 해시만 갱신**합니다.
- **로그인에 직접 쓰이는 것은 DB**이므로, `.env`만 바꾼 뒤에는 시드 또는 `ADMIN_SYNC_ON_START`로 DB를 맞춥니다.

## 5. 디렉토리 구조

```text
backend/
├─ src/
│  ├─ index.ts                 # 부트스트랩, cors, bootstrapAdminIfDbEmpty 등
│  ├─ adminBootstrap.ts       # 초기 admins 없음일 때 생성, ADMIN_SYNC_ON_START
│  ├─ db.ts                   # SQLite 연결/DDL/마이그레이션
│  ├─ routes/apiRouter.ts     # /api 라우트
│  ├─ controllers/
│  ├─ services/               # 도메인(상품·주문·category·support·admin·물류 등)
│  └─ scripts/seedAdmin.ts    # 위 adminBootstrap 의 upsert 사용
├─ data/
│  ├─ app.sqlite
│  └─ uploads/
└─ package.json
```

## 6. API 그룹

### Public

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/auth/wechat-login`

### User API (`requireAuth`)

- `GET /api/me`, `PUT /api/me`
- 주소: `GET/POST/PUT/DELETE /api/addresses`
- 주문: `GET /api/orders`, `GET /api/orders/count`, `GET /api/orders/:orderNo`
- 주문 처리: `POST /api/orders/commit`, `POST /api/orders/:orderNo/refund`
- 고객센터: `GET/POST /api/support/messages`, `POST /api/support/upload-media`

### Admin API (`requireAdmin`)

- `POST /api/admin/login` — `admins` 테이블(`passwordHash`/평문) 검증
- `GET /api/admin/me`
- `PUT /api/admin/me/password`, `PUT /api/admin/me/username`
- 주문: `GET /api/admin/orders`, `POST /api/admin/orders/:orderNo/shipping`, `GET /api/admin/orders/:orderNo/logistics-trace`
- 주문 목록 표시 상태(관리자 계정별): `GET /api/admin/order-visibility`, `PUT /api/admin/order-visibility`
- 상품: `GET /POST/PUT /api/admin/products`, `GET /api/admin/products/:id`, `PUT /api/admin/products/:id/stock`
- 업로드: `POST /api/admin/upload-image`
- 카테고리: `GET/POST/PUT/DELETE /api/admin/categories`
- 고객센터: `GET /api/admin/support/conversations`, `GET/POST .../messages/:userId`, `POST /api/admin/support/upload-media`

PC 관리 SPA는 저장소 상위 디렉터리 `admin-web/` 에서 같은 Admin API를 사용합니다.

## 7. DB/마이그레이션 특징

- `db.ts`에서 테이블 생성과 일부 컬럼 보강(`ALTER TABLE`)을 자동 수행합니다.
- SQLite 설정:
  - `journal_mode = WAL`
  - `busy_timeout = 5000`
  - `foreign_keys = ON`
- 개발 중 `database is locked`가 보이면 중복 백엔드 프로세스를 먼저 점검하세요.

## 8. 업로드 파일 처리

- 서버 시작 시 `backend/data/uploads`를 자동 생성합니다.
- 업로드 결과 파일은 `/uploads/*` 정적 경로로 접근 가능합니다.

## 9. 배포 전 체크리스트

- `WECHAT_APPSECRET`가 저장소/클라이언트에 노출되지 않았는지 확인
- 관리자 초기 비밀번호를 운영용 강한 비밀번호로 재설정
- `PORT`, CORS, 도메인 정책 확인
- DB 백업/복구 전략 준비
