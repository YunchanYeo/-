# 개발자 가이드 (KR)

## 1) 시스템 아키텍처

- `frontend`: WeChat 미니프로그램(사용자/관리자 페이지)
- `admin-web`: React + TypeScript + Vite 기반 관리자 웹
- `backend`: Express + TypeScript + SQLite API 서버
- 미니/웹 모두 동일 백엔드(`/api/*`)를 사용

## 2) 로컬 개발 실행

- 백엔드: `cd backend && npm install && npm run dev`
- 관리자 웹: `cd admin-web && npm install && npm run dev`
- 미니프로그램: WeChat DevTools에서 `frontend` 열기
- 미니 API 주소: `frontend/config/index.js`의 `apiBaseUrl`

## 2-1) 阿里云 전환(2단계) 실행

### A. 미디어 저장소를 OSS로 전환

- 백엔드 환경변수:
  - `MEDIA_PROVIDER=aliyun-oss`
  - `OSS_REGION`
  - `OSS_BUCKET`
  - `OSS_ACCESS_KEY_ID`
  - `OSS_ACCESS_KEY_SECRET`
  - `OSS_PUBLIC_BASE_URL` (권장, CDN/커스텀 도메인 사용 시)
- 적용 범위:
  - 관리자 상품 이미지 업로드
  - 고객센터 이미지/음성 업로드
- 기존 로컬 업로드 이관:
  - `cd backend && npm run migrate:oss`
  - 로컬 `backend/data/uploads` 파일을 OSS에 업로드하고 DB URL을 새 주소로 치환

### B. DB를 PostgreSQL(RDS)로 이관

- PostgreSQL 연결 문자열 준비: `POSTGRES_URL` (또는 `PG_URL`)
- 이관 실행:
  - `cd backend && npm run migrate:pg`
- 이 스크립트는 SQLite의 핵심 테이블 데이터를 PostgreSQL로 복사
  - 대상: `users`, `orders`, `support_messages`, `products`, `coupons` 등
  - 방식: 대상 테이블 `TRUNCATE` 후 전체 재적재(초기 이관용)

## 3) 핵심 구현 포인트

### 주문 관리(관리자 웹)

- 주문 숨김/복구는 관리자 화면 전용 기능(실제 DB 삭제 아님)
- 서버 저장 API: `GET/PUT /api/admin/order-visibility`
- Excel 导入:
  - 중문/영문 헤더 동시 인식
  - dry-run
  - 실패 항목 자동 재시도
  - 실패 항목 Excel 내보내기
- 대량 목록 성능: 가상 스크롤(windowing)

### 고객센터 채팅

- 공통 런타임: `frontend/services/support/chatPageRuntime.js`
- 미니 사용자/관리자:
  - 텍스트/이미지/음성 전송
  - 이모지 패널
  - 상대방 입력 중 표시(`对方正在输入…`)
- 주문 연동(사용자 → 관리자):
  - 사용자 채팅에서 `+` → `选择订单`로 **주문을 선택**하면, 메시지 `meta.orderNo`로 주문번호를 첨부
  - 미니/React 관리자 채팅 UI는 `meta.orderNo`가 있으면 메시지 위에 **주문번호 태그**를 표시
  - React 관리자 웹에서는 태그 클릭 시 `/orders?orderNo=...`로 이동하여 주문 상세를 자동 오픈
- React 관리자:
  - 사용자별 대화 목록
  - 미디어 업로드
  - 이모지 패널
  - 상대방 입력 중 표시

### 입력 중(typing) 상태 API

- 사용자:
  - `GET /api/support/typing`
  - `POST /api/support/typing` `{ typing: boolean }`
- 관리자:
  - `GET /api/admin/support/typing/:userId`
  - `POST /api/admin/support/typing/:userId` `{ typing: boolean }`
- 서버는 메모리 TTL 기반으로 상태를 관리

## 4) 코드 위치 가이드

- 백엔드 라우팅: `backend/src/routes/apiRouter.ts`
- 백엔드 컨트롤러: `backend/src/controllers/apiController.ts`
- 백엔드 채팅 서비스: `backend/src/services/supportService.ts`
- 미니 채팅 API 래퍼: `frontend/services/support/chat.js`
- React 관리자 API 래퍼: `admin-web/src/api/admin.ts`

## 5) 개발 시 주의사항

- `backend/dist`는 빌드 결과물(JS), 소스 수정은 `backend/src`에서만 수행
- SQLite WAL 모드 사용 중이므로 파일 직접 점검 시 WAL 반영 주의
- 미니/웹이 동일 백엔드를 보도록 API Base URL 일치 확인
- OSS 사용 시, 버킷 CORS/퍼블릭 읽기 정책(또는 CDN 서명 정책)을 운영정책에 맞게 설정
- `migrate:pg`는 초기 전체 이관용이며, 운영 중 무중단 전환은 CDC/듀얼라이트 전략 권장

## 6) 검증 체크리스트

- 백엔드: `cd backend && npm run build && npm test`
- 관리자 웹: `cd admin-web && npm run build`
- 채팅 회귀 확인:
  - 텍스트/이미지/음성 전송
  - 주문 선택 후 메시지에 주문번호가 첨부/표시되는지(사용자/관리자/React)
  - 이모지 입력
  - `对方正在输入…` 표시/해제
  - 화면 전환 후 typing 상태 정리

