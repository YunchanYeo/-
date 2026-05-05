# 프론트엔드 데이터 연동 가이드 (초보자용)

이 문서는 `frontend` 코드가 백엔드 API와 어떻게 연결되는지, 실제 프로젝트 구조 기준으로 쉽게 설명합니다.

## 1. 가장 중요한 원칙

- 페이지(`pages/**`)는 화면과 이벤트 처리에 집중
- 서비스(`services/**`)는 API 호출과 데이터 변환에 집중
- 공통 요청은 `services/_utils/http.js`의 `requestJson()`만 사용
- 페이지에서 `wx.request()`를 직접 호출하지 않기

즉, 흐름은 아래처럼 고정하는 것이 좋습니다.

```text
Page -> Service -> requestJson -> Backend API -> DB
```

## 2. 핵심 파일 역할

### 2.1 공통 요청 유틸

- 파일: `frontend/services/_utils/http.js`
- 역할:
  - 공통 헤더 주입 (`Authorization`)
  - HTTP 에러를 사용자 메시지로 변환
  - 백엔드 응답 형식 검증 (`ok`, `data`)

### 2.2 로그인/세션

- 파일: `frontend/services/auth/session.js`
- 역할:
  - 토큰 저장/조회/삭제
  - 위챗 로그인 코드 발급(`wx.login`)
  - 세션 검증(`wx.checkSession`)
  - 로그아웃 시 선로딩 데이터까지 정리

### 2.3 도메인별 서비스

- 상품: `frontend/services/good/*.js`
- 주문: `frontend/services/order/*.js`
- 주소: `frontend/services/address/*.js`
- 고객센터: `frontend/services/support/chat.js`
- 장바구니: `frontend/services/cart/cart.js`

## 3. 실제 예시 1: 홈 상품 목록

### 3.1 페이지

- `frontend/pages/home/home.js`
- `onLoad`/`onShow`에서 `fetchGoodsList` 계열 서비스를 호출

### 3.2 서비스

- `frontend/services/good/fetchGoods.js`
- `/api/products` 호출 후 UI 컴포넌트 형식으로 매핑
- 이미지 URL 정규화(`localhost` -> 현재 `apiBaseUrl`) 처리

### 3.3 백엔드

- 라우트: `/api/products`
- 구현: `backend/src/services/productService.ts`

## 4. 실제 예시 2: 장바구니 동기화

기존 장바구니는 로컬 저장 기반입니다.  
현재는 장바구니 진입 시 최신 DB 상품정보를 재동기화하도록 개선되어 있습니다.

- 위치: `frontend/services/cart/cart.js`
- 동작:
  1) 로컬 장바구니 아이템 로드
  2) `/api/products` 최신 목록 조회
  3) `spuId` 기준으로 가격/재고/제목/이미지 갱신
  4) 수량/선택 상태는 로컬 값을 유지

초보자 팁:

- 상품 기본정보는 서버 기준
- 사용자 조작 상태(수량, 체크)는 로컬 기준

이렇게 분리하면 UX와 데이터 정확도를 둘 다 잡을 수 있습니다.

## 5. 실제 예시 3: 고객센터 채팅

### 사용자

- 페이지: `frontend/pages/user/support-chat`
- 서비스: `frontend/services/support/chat.js`
- API:
  - `GET /api/support/messages`
  - `POST /api/support/messages`
  - `POST /api/support/upload-media`

### 관리자

- 페이지: `frontend/pages/admin/support-chat`
- API:
  - `GET /api/admin/support/conversations`
  - `GET /api/admin/support/messages/:userId`
  - `POST /api/admin/support/messages/:userId`
  - `POST /api/admin/support/upload-media`

### 메시지 타입

- `text`, `image`, `voice`
- 음성은 `meta.durationMs` 사용

## 6. 설정 파일 이해하기

### `frontend/config/index.js`

- `useMock`
  - `true`: 모델 mock 데이터 사용
  - `false`: 실제 백엔드 API 호출
- `apiBaseUrl`
  - 로컬: `http://127.0.0.1:3000`
  - 운영: 실제 API 도메인

## 7. 초보자용 작업 패턴 (권장)

기능을 하나 추가할 때 아래 순서로 작업하면 안정적입니다.

1) 백엔드 라우트/API 먼저 준비  
2) 프론트 `services` 함수 추가  
3) 페이지에서 서비스 호출 연결  
4) 에러 메시지/로딩 상태 처리  
5) `ReadLints`/수동 테스트로 검증

## 8. 자주 하는 실수

- 페이지에서 직접 `wx.request` 호출
- `apiBaseUrl`와 백엔드 포트 불일치
- `useMock=true` 상태에서 실데이터가 안 나온다고 오해
- 백엔드 응답 형식을 `{ ok, data }`로 맞추지 않음
- 이미지 URL의 `localhost`를 그대로 저장해 기기에서 표시 실패

## 9. 체크리스트

기능 수정 후 아래를 확인하세요.

- 콘솔에 401/404/500 에러가 없는가?
- 로딩/실패 UI가 있는가?
- 로그인 상태/비로그인 상태 둘 다 정상인가?
- 관리자에서 수정한 내용이 사용자 화면에 반영되는가?


