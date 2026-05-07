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

## 6) 검증 체크리스트

- 백엔드: `cd backend && npm run build && npm test`
- 관리자 웹: `cd admin-web && npm run build`
- 채팅 회귀 확인:
  - 텍스트/이미지/음성 전송
  - 이모지 입력
  - `对方正在输入…` 표시/해제
  - 화면 전환 후 typing 상태 정리

