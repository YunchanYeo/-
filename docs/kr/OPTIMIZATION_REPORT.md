# 최적화 보고서 (2026-05-07)

## 1) 이번에 적용한 코드 최적화

- `admin-web/src/App.tsx`에 라우트 단위 lazy loading(`React.lazy`, `Suspense`) 적용
- `admin-web/src/pages/Orders.tsx`에서 `xlsx`를 동적 import로 전환(필요 시 로드)
- 목적: 초기 번들 크기 감소 및 첫 화면 로딩 속도 개선

## 2) 검증 결과

### 백엔드 (`backend`)
- `npm run build` 통과
- `npm test` 통과 (3 tests)

### 관리자 웹 (`admin-web`)
- `npm run build` 통과
- 분할 전 메인 JS: 약 811KB
- 분할 후 메인 JS: 약 179KB
- `Orders` 청크: 약 173KB
- `xlsx`는 별도 청크(약 430KB)로 분리되어 Excel 기능 실행 시에만 로드

## 3) 남은 최적화 우선순위

### P1
- `Orders` 페이지 내부 추가 분할
  - 물류 지도/대량 처리 UI를 모듈 분리

### P2
- 공통 유틸 메모이제이션 점검
  - 대량 목록 필터/정렬 계산 경로에서 `useMemo` 범위 재점검

### P3
- 번들 분석 자동화
  - 빌드 시 chunk 리포트 산출 스크립트 추가

## 4) 운영 가이드

- 성능 회귀 확인 기준:
  - `admin-web` 메인 chunk 250KB(gzip 전) 이하 유지 권장
  - 신규 의존성 추가 시 lazy loading 가능 여부를 먼저 검토
