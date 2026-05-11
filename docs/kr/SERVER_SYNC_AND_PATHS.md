# ECS 서버 경로·코드 반영 절차 (에이전트·운영 공용)

본 문서는 **현재 운영 중인 Alibaba Cloud ECS** 기준으로 정리되었다. 서버를 바꾸면 아래 **경로 상수**만 갱신하면 된다.

---

## 1. 경로 상수 (에이전트는 이 값을 기본으로 사용)

| 이름 | 경로 | 설명 |
|------|------|------|
| `ECS_SSH` | `root@39.106.213.185` | SSH 접속 (맥 `deploy/china-test/push-from-mac.sh` 의 `ECS_SSH` 기본값과 동일) |
| `ECS_REPO_ROOT` | `/root/wechat-app` | **`git pull` 하는 쪽**. `.git` 존재. |
| `ECS_LIVE_ROOT` | `/root/wechat-app-live` | **Docker Compose 가 읽는 쪽**. `.git` 없음 (복사본 트리). |
| `ECS_COMPOSE_DIR` | `/root/wechat-app-live/deploy/china-test` | `docker compose up -d --build` 실행 디렉터리. |

백업본 등으로 **`wechat-app-live` 외 경로**를 쓰는 경우가 있으면, 실제 compose 위치는 다음으로 확인한다.

```bash
docker inspect wechat-backend --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}'
```

---

## 2. 왜 `git pull` 이 두 경로로 나뉘는지

- 운영 디렉터리 **`ECS_LIVE_ROOT`** 는 예전에 **Git 없이** 복사·배포된 적이 있어 **`git pull` 불가**할 수 있다.
- **`ECS_REPO_ROOT`** 는 Git 클론이 있으므로 **`git pull origin main`** 으로 최신을 받는다.
- 이후 **`ECS_REPO_ROOT` → `ECS_LIVE_ROOT`** 로 소스를 맞춘 뒤, **`ECS_COMPOSE_DIR`** 에서 이미지를 다시 빌드한다.

---

## 3. 최신 `main` 반영 절차 (서버에서 실행)

```bash
ssh root@39.106.213.185

cd /root/wechat-app
git checkout main
git pull origin main

rsync -a \
  --exclude '.env' \
  --exclude 'data' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  /root/wechat-app/backend/ /root/wechat-app-live/backend/

rsync -a /root/wechat-app/deploy/china-test/ /root/wechat-app-live/deploy/china-test/

rsync -a \
  --exclude 'node_modules' \
  --exclude 'dist' \
  /root/wechat-app/admin-web/ /root/wechat-app-live/admin-web/

cd /root/wechat-app-live/deploy/china-test
docker compose up -d --build
docker compose ps
```

- **`backend/.env`**, **`backend/data/`** 는 운영 비밀·DB이므로 **rsync 제외** 유지.
- `rsync` 미설치 시: `yum install -y rsync` 또는 `apt-get install -y rsync`.
- **`.env`만 바꾼 경우**: `docker compose up -d --no-deps --force-recreate backend` (자세한 이유는 `DEPLOY_CN_WECHAT.md` §5.1).

---

## 4. 맥에서 일부만 올릴 때

- **`deploy/china-test` + `backend/.env`**: 레포 루트에서 `bash deploy/china-test/push-from-mac.sh`  
  - 환경변수: `ECS_SSH`, `ECS_DEST`(기본 `/root/wechat-app-live`).  
  - **백엔드 TS 전체 동기화는 하지 않음** — 코드 반영은 §3 또는 `ECS_REPO_ROOT` 에서 `pull` 후 rsync.

---

## 5. 문서·스크립트 교차 참조

- 통합 배포 가이드: `docs/kr/DEPLOY_CN_WECHAT.md`
- 위챗페이 인증서·`probe:wechat-pay`: `backend/certs/wechat-pay/README.md`

---

## 6. 서버를 갈아엎을 때 (선택)

장기적으로 **`ECS_LIVE_ROOT` 를 `git clone` 으로 다시 만들고** compose 만 그 트리를 쓰면, §3 의 rsync 단계 없이 `git pull` 한 곳에서 빌드할 수 있다. 전환 시 `.env`·`data` 백업 필수.

---

**에이전트 지시:** 사용자가「서버에 반영」「ECS 배포」「git pull 서버」등을 요청하면 **먼저 본 파일을 열어** 위 표의 경로와 §3 명령을 사용한다. SSH 호스트·`ECS_DEST`가 바뀌었다면 사용자에게 문서 갱신을 요청한다.
