# Backend 개발 가이드

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

- `ADMIN_USERNAME` / `ADMIN_PASSWORD`: 시드 스크립트용 관리자 계정
- `WECHAT_APPID` / `WECHAT_APPSECRET`: WeChat 로그인 코드 교환용
- `WECHAT_PAY_MOCK`: `false`가 아니면 결제 mock 모드로 동작

## 4. 관리자 계정 시드

```bash
cd backend
npm run seed:admin
```

- 이미 같은 username이 있으면 비밀번호 해시를 업데이트합니다.
- 초기 관리자 계정은 코드 하드코딩이 아니라 환경변수로만 생성합니다.

## 5. 디렉토리 구조

```text
backend/
├─ src/
│  ├─ index.ts                # 서버 부트스트랩
│  ├─ db.ts                   # SQLite 연결/DDL/마이그레이션
│  ├─ routes/apiRouter.ts     # /api 라우트 선언
│  ├─ controllers/            # HTTP -> service 브리지
│  ├─ services/               # 도메인 로직
│  └─ scripts/seedAdmin.ts    # 관리자 계정 시드
├─ data/
│  ├─ app.sqlite              # DB 파일
│  └─ uploads/                # 업로드 파일
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

- `POST /api/admin/login`
- `GET /api/admin/me`
- `PUT /api/admin/me/password`
- `PUT /api/admin/me/username`
- 주문 관리: `GET /api/admin/orders`, `POST /api/admin/orders/:orderNo/shipping`
- 상품 관리: `GET/POST/PUT /api/admin/products`, `PUT /api/admin/products/:id/stock`
- 파일 업로드: `POST /api/admin/upload-image`
- 고객센터: 대화 목록/상세/답장/미디어 업로드

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
