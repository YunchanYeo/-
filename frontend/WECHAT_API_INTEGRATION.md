# 위챗 미니프로그램 API 연동 가이드

## 목적
이 프로젝트는 위챗 미니프로그램 공식 API를 사용해  
`사용자 동의 기반 로그인` + `백엔드 세션 인증` 구조로 동작합니다.

## 위챗 API 사용 전 꼭 알아둘 점

- **기본 `wx.*` API는 설치/임포트가 필요 없습니다.**
  - `wx`는 미니프로그램 런타임에서 제공되는 전역 객체라 바로 사용할 수 있습니다.
  - 예: `wx.login`, `wx.request`, `wx.navigateTo`, `wx.showToast`
- npm 패키지가 필요한 경우는 `wx` API 자체가 아니라, **추가 라이브러리**를 쓸 때입니다.
  - 예: `tdesign-miniprogram`, `zod`, `axios` 등
- 단, API 호출 권한/환경 설정은 필요합니다.
  - 개발자도구의 `request 合法域名`(합법 도메인) 설정
  - `app.json` 권한/페이지 등록
  - 실제 결제/로그인 운영 시 서비스 계정(AppID/AppSecret/상점 정보) 설정

## 현재 사용 중인 핵심 API

### 로그인/계정
- `wx.login`
  - 백엔드 인증 교환에 필요한 1회성 `code`를 발급합니다.
- `wx.getUserProfile`
  - 사용자 클릭으로 동의를 받고 프로필 정보(`nickName`, `avatarUrl`, `gender`)를 획득합니다.
- `wx.checkSession`
  - 로컬 토큰 사용 전 위챗 세션 유효성을 확인합니다.
- `wx.getAccountInfoSync`
  - 런타임 정보(`appId`, `envVersion`, `version`)를 읽어 진단 로그에 사용합니다.

### 네트워크
- `wx.request`
  - 백엔드 API 호출의 기본 방식입니다.

### 로컬 저장소
- `wx.setStorageSync`, `wx.getStorageSync`, `wx.removeStorageSync`
  - 인증 토큰, 사용자 정보, 선로딩 데이터(주소/주문/카트)를 저장/조회/삭제합니다.

### 페이지 이동
- `wx.navigateTo`, `wx.redirectTo`, `wx.switchTab`, `wx.reLaunch`
  - 일반 페이지/탭 페이지 전환에 사용합니다.

### 미디어
- `wx.chooseMedia`
  - 카메라/앨범에서 이미지 선택.
- `wx.getFileSystemManager().readFile`
  - 선택 파일을 base64로 변환해 업로드 데이터로 사용.

### 사용자 안내(UI/UX)
- `wx.showModal`, `wx.showToast`, `wx.showActionSheet`
  - 로그인 동의, 처리 결과 안내, 선택 UI 표시.

### 런타임/성능
- `wx.onMemoryWarning`, `wx.offMemoryWarning`
  - 메모리 경고 시 대용량 임시 데이터를 비워 앱 안정성을 높입니다.

## API 매트릭스 (필수/권장/선택)

| 구분 | API | 현재 프로젝트 사용 여부 | 용도 |
|---|---|---|---|
| 필수 | `wx.login` | 사용 중 | 백엔드 세션 발급용 code 획득 |
| 필수 | `wx.request` | 사용 중 | 프론트 <-> 백엔드 통신 |
| 필수 | `wx.setStorageSync/getStorageSync` | 사용 중 | 토큰/사용자/카트 데이터 저장 |
| 권장 | `wx.getUserProfile` | 사용 중 | 사용자 동의 기반 프로필 획득 |
| 권장 | `wx.checkSession` | 사용 중 | 세션 만료 감지 후 재로그인 유도 |
| 권장 | `wx.getAccountInfoSync` | 사용 중 | 환경 진단/버전 추적 |
| 권장 | `wx.chooseLocation` | 사용 중 | 주소 자동 입력 보조 |
| 권장 | `wx.chooseMedia` | 사용 중 | 관리자 상품 이미지 업로드 |
| 선택 | `wx.requestPayment` | 구조 반영 | 실제 위챗 결제(운영 계정 필요) |
| 선택 | `wx.requestVirtualPayment` | 구조 반영 | 가상 상품 결제 시나리오 |
| 선택 | `wx.requestPluginPayment` | 구조 반영 | 플러그인 결제 확장 |
| 선택 | `wx.requestCommonPayment` | 구조 반영 | 공통 결제 라우팅 확장 |
| 선택 | `wx.createGlobalPayment` | 구조 반영 | 글로벌 결제 방식 확장 |

## 현재 로그인 아키텍처

1. 사용자가 로그인 트리거 버튼/액션을 누릅니다. (동의 기반)
2. `wx.getUserProfile`로 동의 및 프로필 정보를 획득합니다.
3. `wx.login`으로 1회성 `code`를 받습니다.
4. 프론트가 `code`(+선택적 프로필/계정 정보)를 백엔드 `/api/auth/wechat-login`에 전달합니다.
5. 백엔드가 위챗 `code2session`을 호출해 `openid`를 획득합니다.
6. 백엔드가 사용자 생성/갱신 후 프로젝트 세션 토큰을 발급합니다.
7. 프론트가 토큰 저장 후 사용자 부트스트랩 데이터를 선로딩합니다.
   - `/api/me`
   - `/api/addresses`
   - `/api/orders`
   - `/api/orders/count`

## 중요한 보안/정책 규칙

- `wx.getUserProfile`은 앱 시작 시 자동 호출하면 안 됩니다. 반드시 사용자 동작 기반이어야 합니다.
- `AppSecret`은 프론트에 노출하면 안 됩니다.
- `code2session` 호출은 반드시 백엔드에서만 수행해야 합니다.
- `wx.checkSession` 실패 시 로컬 세션을 정리하고 재동의 로그인을 유도해야 합니다.

## 운영 전 체크리스트

- 백엔드 환경변수 설정:
  - `WECHAT_APPID`
  - `WECHAT_APPSECRET`
- 위챗 개발자도구/관리 콘솔에서 요청 도메인(합법 도메인) 설정.
- 운영 전 개발용 fallback openid 로직 비활성화.
- 토큰 만료/재발급 정책 및 인증 로그(audit) 체계 추가.

