# 프로젝트 문서 인덱스 (KR)

이 저장소는 `frontend`(미니프로그램), `admin-web`(React 관리자), `backend`(Express API)로 구성됩니다.

## 문서 맵

- 운영 가이드: `docs/kr/USER_GUIDE.md`
- 개발 가이드: `docs/kr/DEV_GUIDE.md`
- 배포·微信 도메인 참고: **`docs/kr/DEPLOY_CN_WECHAT.md`**
- **EC2 + 도메인 `hebibingtest.shop`:** **`docs/kr/DEPLOY_EC2_HEBIBINGTEST.md`** · 스택 파일 `deploy/ec2-al2023/`
- **관리자 세션·이미지·OSS·계정 생성(최근 변경):** `docs/kr/ADMIN_MEDIA_SESSIONS.md`
- 최적화 보고서: `docs/kr/OPTIMIZATION_REPORT.md`
- 중국어 문서 인덱스: `docs/cn/README.md`

## 빠른 실행

- 백엔드: `cd backend && npm install && npm run dev`
- 관리자 웹: `cd admin-web && npm install && npm run dev`
- 미니프로그램: WeChat DevTools에서 `frontend` 열기

## 최신 기능 요약

- 주문 관리
  - 관리자 화면 전용 주문 숨김/복구 (`选中隐藏`, `选中恢复`, `查看已隐藏`, `恢复全部`)
  - 계정별 숨김 상태 서버 저장 (`GET/PUT /api/admin/order-visibility`)
  - Excel 导入 고도화(중/영문 헤더 인식, dry-run, 실패 재시도, 실패 내보내기)
  - 주문 리스트 가상 스크롤 적용
- 물류/지도
  - 관리자 웹 트래킹 모달은 `Leaflet + OSM`(키 없음)
- 고객센터 채팅
  - 사용자/관리자/React 관리자 모두 이모지 패널 지원
  - 상대방 입력 중 표시(`对方正在输入…`) 지원
  - 사용자 문의에 주문 연동: 주문 선택 시 `meta.orderNo` 첨부
  - 관리자 채팅에서 주문 태그 표시, React에서는 주문 태그 클릭 시 주문관리로 점프
  - 입력 중 상태 API 추가:
    - 사용자: `GET/POST /api/support/typing`
    - 관리자: `GET/POST /api/admin/support/typing/:userId`
- 인프라(2단계)
  - 미디어 저장소를 阿里云 OSS로 전환 가능 (`MEDIA_PROVIDER=aliyun-oss`)
  - SQLite → PostgreSQL 이관 스크립트 추가 (`npm run migrate:pg`)
  - 기존 로컬 업로드 파일 OSS 이관 스크립트 추가 (`npm run migrate:oss`)
- 관리자·미디어(최근)
  - 관리자 세션 테이블 `admin_sessions` — 계정당 하나의 활성 세션, 재로그인 시 교체, 비번·아이디 변경 시 무효화
  - 상품 이미지: Base64·multipart·OSS 서명 URL 업로드, HEIC/MIME 보정, React 측 모바일 사전 압축 (`prepareAdminProductImage`)
  - 관리자 계정 생성: `POST /api/admin/admins` — React·미니프로그램 계정 설정 화면
  - 상세: **`docs/kr/ADMIN_MEDIA_SESSIONS.md`**

## 디렉터리 개요

```text
frontend/   # 미니프로그램 (사용자/관리자 페이지)
admin-web/  # React 관리자 웹
backend/    # Express + SQLite API 서버
deploy/     # 배포 안내 README (ECS 전용 compose 제거됨)
docs/kr/    # 한국어 문서
docs/cn/    # 중국어 문서
```

## 검증 명령

- 백엔드 빌드/테스트: `cd backend && npm run build && npm test`
- 관리자 웹 빌드: `cd admin-web && npm run build`

