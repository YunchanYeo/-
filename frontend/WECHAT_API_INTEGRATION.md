# 위챗 미니프로그램 API 연동 문서

이 문서는 현재 프로젝트에서 실제로 사용하는 `wx.*` API를 기능별로 정리하고, 초보자도 바로 적용할 수 있게 사용 흐름과 주의사항을 설명합니다.

## 1. 기본 개념

- `wx` 객체는 미니프로그램 런타임이 제공하므로 별도 설치가 필요 없습니다.
- 인증/결제 같은 민감 로직은 반드시 백엔드와 함께 사용해야 합니다.
- 프론트는 사용자 동작을 받고, 백엔드는 권한/검증/DB 저장을 담당합니다.

## 2. 프로젝트에서 사용하는 주요 API

### 2.1 인증/세션

- `wx.login`
  - 위챗 로그인 `code` 획득
  - 백엔드 `/api/auth/wechat-login`로 전달
- `wx.getUserProfile`
  - 사용자 동의 기반 프로필 획득
  - 자동 호출 금지(버튼/탭 등 사용자 액션 필요)
- `wx.checkSession`
  - 위챗 세션 유효성 확인
  - 만료 시 로그아웃 후 재로그인 유도

### 2.2 네트워크

- `wx.request`
  - 프로젝트에서는 직접 호출보다 `requestJson` 래퍼 사용 권장

### 2.3 저장소

- `wx.setStorageSync`, `wx.getStorageSync`, `wx.removeStorageSync`
  - 토큰, 사용자 정보, 선로딩 데이터 저장

### 2.4 미디어

- `wx.chooseMedia`
  - 이미지 선택/촬영
- `wx.getRecorderManager`
  - 음성 녹음
- `wx.createInnerAudioContext`
  - 음성 재생
- `wx.getFileSystemManager().readFile`
  - 파일 -> base64 변환 후 업로드

### 2.5 페이지/UX

- `wx.navigateTo`, `wx.redirectTo`, `wx.switchTab`
- `wx.showToast`, `wx.showModal`, `wx.showActionSheet`
- `wx.previewImage`

## 3. 로그인 흐름 (현재 프로젝트 기준)

1) 사용자 클릭으로 로그인 시작  
2) `wx.login`으로 `code` 획득  
3) 필요 시 `wx.getUserProfile`로 프로필 획득  
4) `/api/auth/wechat-login` 호출  
5) 백엔드에서 사용자 생성/갱신 + 세션 토큰 발급  
6) 프론트에서 토큰 저장 + 부트스트랩 데이터 선로딩

관련 코드:

- 프론트: `frontend/services/auth/session.js`
- 백엔드: `backend/src/services/authService.ts`

## 4. 고객센터(온라인 채팅) API 흐름

### 사용자

- 메시지 목록 조회: `GET /api/support/messages`
- 메시지 전송: `POST /api/support/messages`
- 이미지/음성 업로드: `POST /api/support/upload-media`

### 관리자

- 대화 목록: `GET /api/admin/support/conversations`
- 특정 사용자 대화: `GET /api/admin/support/messages/:userId`
- 답장 전송: `POST /api/admin/support/messages/:userId`
- 이미지/음성 업로드: `POST /api/admin/support/upload-media`

## 5. `app.json`에서 중요한 권한

현재 프로젝트에서 특히 중요한 권한:

- `scope.record`: 음성 메시지 녹음
- `requiredPrivateInfos`의 주소 관련 설정

권한이 빠지면 API가 정상 호출되어도 UX가 실패할 수 있습니다.

## 6. 운영/보안 체크리스트

### 필수

- `WECHAT_APPID`, `WECHAT_APPSECRET`를 백엔드 환경변수로 설정
- `AppSecret` 프론트 노출 금지
- 도메인(허용 도메인) 설정 점검

### 권장

- 토큰 만료 처리 표준화
- 인증 실패 로그 수집
- 로그인 실패 횟수 제한(관리자)

## 7. 자주 발생하는 문제

### 로그인이 안 됨

- `WECHAT_APPID/APPSECRET` 미설정 확인
- 개발 중이면 dev fallback 동작 여부 확인
- `wx.checkSession` 실패 후 토큰이 지워졌는지 확인

### 이미지/음성 업로드 실패

- 파일 크기/형식 확인
- base64 변환 실패 여부 확인
- 백엔드 `uploads` 정적 경로(`/uploads`) 확인

### 실기기에서 API 실패

- `apiBaseUrl`이 `localhost`로 되어 있지 않은지 확인
- 합법 도메인/HTTPS 정책 확인


