# 관리자 기능·미디어·세션 변경 정리

이 문서는 **관리자 다중 세션**, **관리자 계정 생성**, **상품 이미지 업로드(OSS/멀티파트/용량)** 및 **배포 시 확인 사항**을 한곳에 정리합니다. 코드 기준 시점은 저장소 현재 버전입니다.

---

## 1. 요약

| 영역 | 내용 |
|------|------|
| 인증 | `admin_sessions` 테이블로 활성 세션 관리. **동일 관리자 계정**으로 다시 로그인하면 이전 세션 무효화. **서로 다른 관리자 계정**은 각각 로그인 유지 가능. |
| 계정 생성 | 로그인한 관리자가 **현재 비밀번호**로 본인 확인 후, 새 관리자 ID·초기 비밀번호 생성 (`POST /api/admin/admins`). React·미니프로그램 설정 화면에서 호출. |
| 상품 이미지 | DB BLOB가 아니라 **로컬 디스크** 또는 **阿里云 OSS**에 저장 후, DB에는 **URL 문자열** 저장. 업로드 경로: Base64 JSON, multipart, OSS 서명 URL 직접 PUT. |
| 용량 | 단일 파일 최대 약 **30MB**(백엔드·multer). Express JSON **55MB**, Nginx `client_max_body_size` **55m** (Base64 페이로드 여유). |

---

## 2. 관리자 세션 (`admin_sessions`)

### 동작

- 로그인 성공 시 `admin_sessions`에 `(adminId, token)` 한 행을 넣고, **같은 adminId의 기존 행은 삭제**합니다. 그래서 **한 계정당 동시에 유효한 세션은 하나**입니다.
- `requireAdmin`은 `admin_sessions.token`과 레거시 `admins.sessionToken` 둘 다 인정합니다(구 클라이언트 호환).

### 세션이 끊기는 경우

- **같은 계정으로 다른 기기/브라우저에서 다시 로그인**
- **비밀번호 변경** 또는 **사용자명 변경** 시 해당 관리자의 `admin_sessions` 삭제

### 스키마 (SQLite)

`backend/src/db.ts`에 정의됨:

- `admin_sessions(adminId UNIQUE, token UNIQUE, …)` + `idx_admin_sessions_token`

---

## 3. 관리자 계정 생성

### API

- **메서드·경로:** `POST /api/admin/admins`
- **인증:** 관리자 토큰 필수 (`Authorization: Bearer …` 또는 `X-Admin-Token`)
- **본문 (JSON):**

  | 필드 | 제약 |
  |------|------|
  | `currentPassword` | 필수 — 조작자 본인 확인 |
  | `username` | 4~40자 |
  | `password` | 6~128자 — bcrypt 저장 |

- **응답:** 생성된 관리자 `id`, `username`, `createdAt`, `updatedAt`
- **오류 예:** 현재 비밀번호 불일치(401), 사용자명 중복(409)

### 프론트엔드 위치

- **React:** `admin-web/src/pages/Settings.tsx` — 계정 설정 페이지의 생성 폼
- **미니프로그램:** `frontend/pages/admin/settings/` — 동일 목적의 폼
- **클라이언트:** `admin-web/src/api/admin.ts` 의 `createAdminAccount`, `frontend/services/admin/adminApi.js` 의 `createAdminAccount`

---

## 4. 상품 이미지 업로드

### 저장 위치

- **`MEDIA_PROVIDER` 미설정 또는 `local`:** `data/uploads/` 등 로컬 경로에 저장, DB에는 상대 URL 등으로 저장.
- **`MEDIA_PROVIDER=aliyun-oss`:** OSS 객체로 업로드, DB에는 **공개 접근 가능한 URL** 문자열 저장.

### 백엔드 엔드포인트

| 경로 | 설명 |
|------|------|
| `POST /api/admin/upload-image` | JSON Base64 (레거시·폴백) |
| `POST /api/admin/upload-image-multipart` | `multipart/form-data`, 필드명 `file` |
| `POST /api/admin/upload-image-sign` | OSS 직접 PUT용 **서명 URL** 발급 |

관리자 인증은 위 세 경로 모두 동일합니다.

### React 관리자 (`admin-web`)

- `ProductFormPage.tsx`: 이미지 선택 시 `prepareAdminProductImage`로 모바일·HEIC·대용량에 대해 **클라이언트 측 JPEG 재인코딩·축소** 후,
  1. 서명 URL 발급 → 브라우저에서 OSS로 PUT 시도  
  2. 실패 시 multipart 업로드  
  3. 그 다음 Base64 업로드 폴백  

유틸: `admin-web/src/utils/prepareAdminProductImage.ts`

### MIME·확장자

- 백엔드 `normalizeAdminProductMime`에서 빈 MIME, `application/octet-stream`, `.heic`/`.heif` 확장자 등 보정.
- HEIC/HEIF 저장 확장자는 웹 호환을 위해 종종 `jpg`로 통일하는 정책(`mediaStorage.ts`의 `detectExt`).

---

## 5. 환경 변수 (백엔드 `.env`)

필요 시 `backend/.env.example` 참고.

### OSS 사용 시

| 변수 | 설명 |
|------|------|
| `MEDIA_PROVIDER` | `aliyun-oss` 로 설정해야 OSS 경로 사용 |
| `OSS_BUCKET` | 버킷 이름 |
| `OSS_ACCESS_KEY_ID` / `OSS_ACCESS_KEY_SECRET` | RAM 사용자 키(저장소에 커밋 금지) |
| `OSS_REGION` | **버킷 리전과 반드시 일치.** 공개 URL 생성 시 `https://{bucket}.{region}.aliyuncs.com/...` 형태로 쓰이므로, 콘솔에 표시되는 **엔드포인트 형식**(예: `oss-cn-hangzhou`)과 맞출 것. `cn-hangzhou`만 넣어 도메인이 깨지면 `getaddrinfo ENOTFOUND` 또는 endpoint 불일치 오류가 납니다. |
| `OSS_PUBLIC_BASE_URL` | (선택) CDN·커스텀 도메인 베이스 URL. 지정 시 객체 URL은 이 값 기준 |

배포 후 컨테이너에 반영 여부 확인 예:

```bash
docker compose exec backend sh -lc 'echo "$MEDIA_PROVIDER" "$OSS_REGION"'
```

`.env` 수정 뒤에는 **`docker compose up -d --build --force-recreate backend`** 등으로 재생성하는 것이 안전합니다.

### 기타

- `PUBLIC_UPLOAD_BASE_URL` — 로컬/공인 사이트 원점 등, URL 생성에 사용되는 경우가 있음 (`backend/.env.example` 주석 참고).

---

## 6. 리버스 프록시·관리자 웹 (Docker)

- **`admin-web/nginx.conf`**
  - `client_max_body_size 55m` — 대용량 이미지(Base64 포함) 업로드 여유
  - `/api/` → 백엔드 프록시, **타임아웃 120초**

ECS 등에서 설정을 바꾼 뒤 **`admin-web` 이미지 재빌드·컨테이너 재생성**이 필요합니다.

배포 시: 본인이 둔 `docker-compose.yml` 이 있는 디렉터리에서 `docker compose up -d --build --force-recreate backend admin-web` 등으로 재기동합니다.

---

## 7. 미니프로그램·운영 시 도메인

- 미니프로그램이 호출하는 API 호스트는 **`frontend/config/index.js`** 의 `apiBaseUrl` 로직과 일치해야 합니다.
- **微信公众平台 → 开发 → 开发管理 → 开发设置 → 服务器域名** 에서 `request合法域名`·필요 시 `uploadFile` / `downloadFile` 에 **HTTPS API 호스트** 및 **OSS 공개 호스트**를 등록합니다.
- 서버가 중국 ECS에 있어도, **미니프로그램은 반드시 등록된 도메인으로만 통신**합니다. 출시·실기 테스트 전에 위 설정을 먼저 맞추는 것이 좋습니다.

---

## 8. 관련 파일 목록 (참고)

| 구분 | 경로 |
|------|------|
| 세션·로그인 | `backend/src/services/authService.ts` |
| 관리자 비즈니스 | `backend/src/services/adminService.ts` |
| 라우트 | `backend/src/routes/apiRouter.ts` |
| 미디어 저장 | `backend/src/storage/mediaStorage.ts` |
| DB 스키마 | `backend/src/db.ts` |
| Express 본문 한도 | `backend/src/index.ts` (`express.json({ limit: '55mb' })`) |
| React 업로드 UI | `admin-web/src/pages/ProductFormPage.tsx` |
| React 계정 설정 | `admin-web/src/pages/Settings.tsx` |
| 미니프로그램 관리자 설정 | `frontend/pages/admin/settings/` |
| 미니프로그램 API 설정 | `frontend/config/index.js` |

---

## 9. 검증 명령

```bash
cd backend && npm run build && npm test
cd ../admin-web && npm run build
```

위 명령으로 백엔드·관리자 웹 빌드 및 백엔드 테스트를 권장합니다.
