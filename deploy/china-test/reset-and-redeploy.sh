#!/usr/bin/env bash
# 서버(ECS)에서 레포 루트 기준으로 실행:
#   bash deploy/china-test/reset-and-redeploy.sh
#
# 기본 동작: 컨테이너/네트워크만 내렸다가(main 최신화 후) 재빌드+기동
# 강한 초기화(데이터 볼륨까지 삭제): WIPE_VOLUMES=1 로 실행
#   WIPE_VOLUMES=1 bash deploy/china-test/reset-and-redeploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "[reset] 이동: $ROOT/deploy/china-test"
cd "$ROOT/deploy/china-test"

echo "[reset] docker compose down ..."
if [[ "${WIPE_VOLUMES:-0}" == "1" ]]; then
  echo "[reset] WIPE_VOLUMES=1 → 볼륨까지 삭제합니다 (backend_data/caddy_data/postgres_data 등)."
  docker compose down -v --remove-orphans
else
  docker compose down --remove-orphans
fi

echo "[reset] (선택) dangling 이미지/캐시 정리 ..."
if [[ "${PRUNE_DOCKER:-0}" == "1" ]]; then
  docker system prune -af || true
fi

echo "[git] origin/main 최신화 ..."
cd "$ROOT"
git fetch --prune
git checkout main
git reset --hard origin/main

echo "[redeploy] docker compose up -d --build ..."
cd "$ROOT/deploy/china-test"
docker compose up -d --build

echo ""
docker compose ps
echo "[redeploy] Caddy 로그 (최근 50줄) …"
docker compose logs --tail=50 caddy 2>/dev/null || true
echo "[done] ok"
