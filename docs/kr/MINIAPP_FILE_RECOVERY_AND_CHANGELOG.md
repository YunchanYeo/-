# 미니프로그램 페이지 파일 복구 · 파일명 규칙 · 최근 변경 요약

## 1. `index.wxml` vs `home.wxml` (자주 헷갈리는 부분)

微信小程序은 **`app.json`의 `pages` 항목에 적힌 경로 마지막 세그먼트**가 곧 **4개 파일의 공통 접두어**입니다.

| `app.json` 경로 | 실제 파일 (동일 폴더) |
|----------------|----------------------|
| `pages/home/home` | `home.js`, `home.json`, **`home.wxml`**, `home.wxss` |
| `pages/usercenter/index` | `index.js`, `index.json`, **`index.wxml`**, `index.wxss` |
| `pages/category/index` | `index.*` |
| `pages/cart/index` | `index.*` |

- **首页**는 `pages/home/` 아래에 **`index`가 아니라 `home`** 이므로, 삭제하신 파일이 홈 화면이라면 복구 대상은 **`frontend/pages/home/home.wxml`** (및 필요 시 `home.wxss`) 입니다.  
- **탭바 커스텀**은 `frontend/custom-tab-bar/index.wxml` 등 `index` 접두어를 씁니다.

## 2. 실수로 지웠을 때 복구 (Git)

저장소가 Git으로 관리 중이면 **마지막 커밋 기준**으로 되돌릴 수 있습니다.

```bash
cd /Users/yeoyunchan/Desktop/project/微信小程序

# 특정 파일만 복구 (예: 홈)
git checkout HEAD -- frontend/pages/home/home.wxml frontend/pages/home/home.wxss

# 탭바
git checkout HEAD -- frontend/custom-tab-bar/index.wxml frontend/custom-tab-bar/index.wxss

# 사용자센터 메인
git checkout HEAD -- frontend/pages/usercenter/index.wxml frontend/pages/usercenter/index.wxss
```

- **어느 파일인지 모를 때**: `git status` 로 삭제(D) 표시 확인 후 위처럼 경로 지정.  
- **커밋 전에만 로컬에 있던 내용**은 Git에 없으면 복구 불가 → Time Machine / IDE Local History 등만 해당.

## 3. 최근 변경 요약 (프로젝트 기준, 미니프로그램·연동)

아래는 대화·작업 맥락을 반영한 **기능 단위 요약**입니다. 세부 diff는 `git log` / PR로 확인하세요.

### 3.1 주소 ·微信导入

- **`frontend/pages/user/address/list`**: 「微信地址导入」가 편집 페이지로만 가던 것을 **`bind:change`에서 직접 `createDeliveryAddress`** 하도록 변경(목록에서 즉시 저장).  
- **`frontend/pages/user/components/t-location`**: `addressParse` 실패 시에도 `change` 이벤트로 폼에 이름·지역 등 전달.  
- **`frontend/pages/user/components/utils/addressParse`**: 정확 일치 후 느슨 매칭으로 코드 매칭 보강.  
- **`frontend/pages/user/address/edit`**: 위챗 가져온 뒤 지역 코드 보강·검증 통과 시 **`formSubmit` 자동 호출** 등.  
- **`frontend/pages/usercenter`**: 로그인 동선 **`syncAddressFromWechat`** — 기존 주소가 있어도 무조건 스킵하지 않고 **중복 지문**일 때만 스킵.

### 3.2 로그인 후 个人中心 프로필(아바타·닉네임)

- **`frontend/services/auth/session.js`**: `prefetchUserBootstrapData` 후 **`setUser(me)`** 동기화, **`refreshSessionProfileFromServer()`** 추가·로그인 플로우에서 호출.  
- **`frontend/services/usercenter/fetchUsercenter.js`**: `Promise.allSettled`로 일부 API 실패 시에도 `/api/me` 등 살림; **`getUser()`** 와 API 결과 병합.  
- **`backend/src/services/userService.ts`**: `me` / `updateMe`를 **async 핸들러**로 정리(응답 타이밍 명확화).  
- **`frontend/pages/usercenter/components/user-center-card`**: 표시는 **`userInfo` 직접 바인딩**.  
- **`frontend/pages/usercenter/index.js`**: **`applyHeaderFromStoredUser()`** 로 로그인 직후 스토리지 프로필 즉시 반영.  
- **`frontend/pages/user/services/fetchPerson.js`**: `onShow`에서 갱신 등.  
- **`frontend/services/usercenter/displayNameForUserCenter.js`**: 닉이 없거나 `微信用户`이면 **표시명을 휴대폰 번호(11자리)** 로.

### 3.3 관리자(미니프로그램) · 客服会话

- **`getAdminToken` import 경로 수정**: `pages/admin/support-chat` 및 `pages/admin/services/support/chat.js` → **`../../../services/admin/session`**.  
- **`frontend/pages/admin/services/support/chatPageRuntime.js`**: 서브패키지 간 `export * from` **사용자 패키지 참조 제거**(동일 코드 인라인). 위챗 **`module ... chatPageRuntime` 로드 실패** 방지.  
- **`frontend/pages/admin/dashboard`**: `gotoSupportChat`에서 **`wx.loadSubpackage({ name: 'admin' })`** 후 이동·실패 시 토스트.

### 3.4 기타

- **`frontend/config/runtime.js`**: 배포 API 베이스 등(프로젝트별로 수정).  
- **EC2 배포**: `deploy/ec2-al2023/README.md`, `docs/kr/DEPLOY_EC2_HEBIBINGTEST.md` — `git pull` + `docker compose up -d --build`, `.env`는 `sync-backend-env.sh` 또는 서버에서 직접 수정 후 `force-recreate backend`.

## 4. 관련 경로 빠른 참조

| 용도 | 경로 |
|------|------|
| 앱 진입·탭 | `frontend/app.json` |
| 홈 UI | `frontend/pages/home/home.wxml` |
| 我的 | `frontend/pages/usercenter/index.wxml` |
| 커스텀 탭바 | `frontend/custom-tab-bar/index.wxml` |
| API 베이스(미니) | `frontend/config/runtime.js` |
| 사용자 세션 | `frontend/services/auth/session.js` |
| 마이페이지 데이터 조합 | `frontend/services/usercenter/fetchUsercenter.js` |
| 관리자 미니 채팅 | `frontend/pages/admin/support-chat/` |

문서 인덱스: `docs/kr/README.md`
