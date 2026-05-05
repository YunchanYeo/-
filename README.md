# 위챗 미니프로그램 프로젝트 통합 문서 (한국어)

이 문서는 지금까지 이 프로젝트에서 진행된 핵심 작업을 초보자도 이해할 수 있게 한국어로 정리한 통합 가이드입니다.

## 1) 프로젝트 한 줄 요약

- `frontend/`: 위챗 미니프로그램 화면/사용자 동작 코드
- `backend/`: API 서버 + SQLite 데이터 저장소
- 구조: 프론트가 백엔드 API를 호출하고, 백엔드가 DB를 조회/수정해 결과를 반환

## 2) 현재 아키텍처

```text
.
├─ frontend/                         # 미니프로그램 앱
│  ├─ app.js                         # 앱 시작/로그인 유도/업데이트 체크
│  ├─ pages/                         # 홈/상세/주문/마이페이지 등 화면
│  ├─ services/                      # API 호출 로직
│  │  ├─ _utils/http.js              # 공통 HTTP 요청 + 에러 처리 표준화
│  │  └─ auth/session.js             # 토큰/유저/위챗 로그인/세션 검증
│  ├─ config/index.js                # useMock, apiBaseUrl 등 실행 설정
│  └─ docs/FRONTEND_SDK.md           # 프론트 SDK 흐름 설명 문서
│
├─ backend/                          # 백엔드 서버
│  ├─ src/index.js                   # API 라우트
│  ├─ src/db.js                      # DB 연결/초기화/마이그레이션
│  └─ data/app.sqlite                # 실제 SQLite 파일
│
└─ README.md                         # 현재 문서 (통합 가이드)
```

## 3) 지금까지 작업된 핵심 내용

### 3-1. HTTP 통신 표준화

`frontend/services/_utils/http.js` 기준:

- `wx.request`를 `requestJson()`으로 감싸 재사용 가능하게 통합
- `Authorization: Bearer <token>` 자동 주입
- HTTP 상태코드별 사용자 친화 힌트 제공(예: 404/500/504)
- 서버 비정상 응답(`ok: false`, JSON 아님) 방어 처리
- 타임아웃/네트워크 실패를 구분해 에러 코드로 전달
- 401은 자동 재로그인 대신 "사용자 동의 기반 로그인" 정책으로 상위에서 처리

### 3-2. 인증/세션 로직 정리

`frontend/services/auth/session.js` 기준:

- 토큰/유저 저장: `wx.setStorageSync`, `wx.getStorageSync` 사용
- 로그아웃 시 토큰 + 선로딩(prefetch) 데이터까지 정리
- `loginWithWeChat()`:
  - `wx.login`으로 code 획득
  - `/api/auth/wechat-login`으로 전달
  - 토큰/유저 저장 후 부트스트랩 데이터 선로딩
- `ensureAuthSession()`:
  - 기존 토큰 확인
  - `wx.checkSession`으로 위챗 세션 유효성 검증
  - 만료 시 안전하게 세션 정리
- `syncUserProfileByWeChat()`:
  - `wx.getUserProfile` 동의 기반 프로필 획득
  - `/api/me` 갱신 및 로컬 사용자 정보 반영

### 3-3. 앱 시작 동작 정책

`frontend/app.js` 기준:

- 앱 시작 시 자동 로그인 강제하지 않음 (동의 기반 정책 준수)
- 토큰이 없을 때만 로그인 모달 1회 노출
- 사용자 확인 시 `syncUserProfileByWeChat()` 실행
- 성공/실패 토스트 처리로 사용자 피드백 제공
- `updateManager`로 앱 업데이트 체크 유지

### 3-4. 문서화 진행 사항

- `frontend/WECHAT_API_INTEGRATION.md`:
  - 위챗 API 사용 규칙/보안 주의사항/로그인 아키텍처 정리
- `frontend/docs/FRONTEND_SDK.md`:
  - 페이지 -> 서비스 -> 백엔드 호출 흐름을 초보자 관점으로 설명
- 본 `README.md`:
  - 지금까지 작업을 통합 정리한 기준 문서로 갱신

## 4) 빠른 실행 방법

### 4-1. 백엔드 실행

```bash
cd backend
npm install
npm run dev
```

정상 로그 예시:

```text
[backend] listening on http://127.0.0.1:3000
```

### 4-2. API 상태 확인

- 브라우저: `http://127.0.0.1:3000/api/health`
- 기대 응답: `{ "ok": true, "message": "backend is running" }`

### 4-3. 프론트 설정 확인

`frontend/config/index.js`:

```js
useMock: false
apiBaseUrl: 'http://127.0.0.1:3000'
```

### 4-4. 위챗 개발자도구 재컴파일

- 프로젝트를 다시 컴파일해 최신 코드 반영 확인

## 5) 현재 확인된 주요 API

- `GET /api/health`: 서버 상태
- `GET /api/products`: 상품 목록
- `GET /api/products/:id`: 상품 상세
- `POST /api/products`: 상품 등록
- `POST /api/auth/wechat-login`: 위챗 로그인 교환
- `GET/PUT /api/me`: 내 정보 조회/수정
- `GET /api/addresses`: 주소 목록
- `GET /api/orders`: 주문 목록
- `GET /api/orders/count`: 주문 카운트

## 6) 자주 발생하는 문제와 해결

- 상품이 안 보일 때
  - 백엔드 실행 상태, `apiBaseUrl`, `useMock`, 상품 `status=ON` 순서 확인
- `legal domain list` 오류
  - 개발자도구의 도메인 검사 설정 확인
- 404/500 오류
  - `http.js`가 상태코드별 의미를 메시지로 출력하므로 콘솔 로그 우선 확인
- 세션 만료 반복
  - `wx.checkSession` 실패 시 로그아웃 처리 후 다시 동의 로그인 진행

## 7) 다음 개선 우선순위

1. 상품 수정/삭제 API (`PATCH`, `DELETE`)
2. 장바구니 API 및 상태 동기화 강화
3. 주문 결제 흐름 고도화(실결제/가상결제 분기)
4. 인증 실패/재시도 UX 표준화
5. 운영 로그/감사(audit) 체계 추가

## 8) MVC 구조 반영 (백엔드)

백엔드에 라우터/컨트롤러/서비스 분리 구조를 도입했습니다.

- `backend/src/routes/apiRouter.js`
  - URL 경로와 HTTP 메서드만 정의
- `backend/src/controllers/apiController.js`
  - 요청을 받아 서비스 호출, 응답 반환
- `backend/src/services/apiService.js`
  - 인증/상품/관리자/주문 등 비즈니스 로직 수행

`backend/src/index.js`는 서버 부트스트랩(미들웨어, 정적파일, 에러핸들러, listen)에 집중하고,
실제 API 역할은 위 3개 계층으로 분리해 유지보수가 쉬워졌습니다.

