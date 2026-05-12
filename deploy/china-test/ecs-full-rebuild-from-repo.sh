#!/usr/bin/env bash
# ECS 에서 Git 클론 트리 기준으로 실행 (문서: docs/kr/SERVER_SYNC_AND_PATHS.md §3).
#
#   ssh root@39.106.213.185
#   bash /root/wechat-app/deploy/china-test/ecs-full-rebuild-from-repo.sh
#
# 동작 요약:
#   1) ECS_REPO_ROOT 에서 origin/main 과 동일하게 맞춤 (로컬 커밋 있으면 사라짐 → 미리 백업)
#   2) backend / deploy/china-test / admin-web 를 ECS_LIVE_ROOT 로 rsync (.env·data 제외)
#   3) compose down → build --no-cache → up -d
#
# ─── 서버 「완전 초기화」(Docker 볼륨까지 삭제 = DB·업로드·Caddy 캐시 초기화) ───
#   CONFIRM_SERVER_FULL_RESET=YES_DELETE_ALL_DATA SERVER_FULL_RESET=1 bash .../ecs-full-rebuild-from-repo.sh
#   - 반드시 미리: LIVE 의 backend/.env 백업 (rsync 가 덮어쓰지 않지만 볼륨 삭제 후 재기동 시 필요)
#
# 환경 변수:
#   ECS_REPO_ROOT   기본 /root/wechat-app
#   ECS_LIVE_ROOT   기본 /root/wechat-app-live
#   SERVER_FULL_RESET=1 + CONFIRM_SERVER_FULL_RESET=YES_DELETE_ALL_DATA → WIPE_VOLUMES + 기본 PRUNE
#   WIPE_VOLUMES=1  compose 볼륨 삭제 (단독으로도 가능)
#   PRUNE_DOCKER=1  docker system prune -af
#
set -euo pipefail

if [[ "${SERVER_FULL_RESET:-0}" == "1" ]]; then
  if [[ "${CONFIRM_SERVER_FULL_RESET:-}" != "YES_DELETE_ALL_DATA" ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo " SERVER_FULL_RESET=1 은 Docker 볼륨(backend SQLite 데이터·Caddy 인증서 저장소 등)을 삭제합니다."
    echo " 사용자·주문·관리자 세션 등 운영 데이터가 초기화될 수 있습니다."
    echo " 진행하려면 아래 한 줄을 그대로 실행하세요:"
    echo ""
    echo " CONFIRM_SERVER_FULL_RESET=YES_DELETE_ALL_DATA SERVER_FULL_RESET=1 bash \"${BASH_SOURCE[0]}\""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
  fi
  export WIPE_VOLUMES=1
  export PRUNE_DOCKER="${PRUNE_DOCKER:-1}"
  echo "[모드] SERVER_FULL_RESET — 볼륨 삭제 + (기본) docker prune 후 무캐시 재빌드"
fi

REPO="${ECS_REPO_ROOT:-/root/wechat-app}"
LIVE="${ECS_LIVE_ROOT:-/root/wechat-app-live}"

if [[ ! -d "$REPO/.git" ]]; then
  echo "오류: Git 저장소가 아닙니다: $REPO (.git 없음). ECS_REPO_ROOT 를 확인하세요." >&2
  exit 1
fi

echo "[1/5] Git: $REPO → origin/main"
cd "$REPO"
git fetch --prune origin
git checkout main
git reset --hard origin/main

echo "[2/5] rsync → $LIVE (.env / backend/data 제외)"
mkdir -p "$LIVE/backend" "$LIVE/deploy/china-test" "$LIVE/admin-web"
rsync -a \
  --exclude '.env' \
  --exclude 'data' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  "$REPO/backend/" "$LIVE/backend/"
rsync -a "$REPO/deploy/china-test/" "$LIVE/deploy/china-test/"
rsync -a \
  --exclude 'node_modules' \
  --exclude 'dist' \
  "$REPO/admin-web/" "$LIVE/admin-web/"

COMPOSE_DIR="$LIVE/deploy/china-test"
cd "$COMPOSE_DIR"

echo "[3/5] docker compose down ..."
if [[ "${WIPE_VOLUMES:-0}" == "1" ]]; then
  echo "  → WIPE_VOLUMES=1 : 볼륨 삭제 (SQLite·Caddy 인증서 캐시 등 초기화)"
  docker compose down -v --remove-orphans
else
  docker compose down --remove-orphans
fi

if [[ "${PRUNE_DOCKER:-0}" == "1" ]]; then
  echo "[옵션] docker system prune -af"
  docker system prune -af || true
fi

echo "[4/5] docker compose build --no-cache …"
docker compose build --no-cache

echo "[5/5] docker compose up -d …"
docker compose up -d

echo ""
docker compose ps
echo ""
echo "[caddy] 최근 로그"
docker compose logs --tail=40 caddy 2>/dev/null || true
echo ""
echo "[done] 헬스: curl -sS https://39-106-213-185.sslip.io/api/health"
echo "       (도메인은 환경에 맞게 바꿈). backend/.env 는 rsync 제외 → 서버에 기존 파일 유지."
