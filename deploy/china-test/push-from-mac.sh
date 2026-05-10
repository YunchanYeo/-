#!/usr/bin/env bash
# 맥에서 실행: deploy 동기화 → .env 업로드 → 서버에서 docker compose
# 사용법: bash deploy/china-test/push-from-mac.sh
# (레포 루트 또는 아무 디렉터리에서 실행 가능)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REMOTE="${ECS_SSH:-root@39.106.213.185}"
DEST="${ECS_DEST:-/root/wechat-app-live}"

echo "[1/3] deploy/china-test → ${REMOTE}:${DEST}/deploy/china-test"
tar czf - -C "${ROOT}/deploy/china-test" . \
  | ssh "${REMOTE}" "mkdir -p ${DEST}/deploy/china-test && tar xzf - -C ${DEST}/deploy/china-test"

if [[ -f "${ROOT}/backend/.env" ]]; then
  echo "[2/3] backend/.env → ${REMOTE}:${DEST}/backend/.env"
  scp "${ROOT}/backend/.env" "${REMOTE}:${DEST}/backend/.env"
else
  echo "[2/3] 건너뜀: ${ROOT}/backend/.env 없음 (서버에서 직접 .env 설정)"
fi

echo "[3/3] 서버에서 docker compose up -d --build"
ssh "${REMOTE}" "cd ${DEST}/deploy/china-test && docker compose up -d --build && docker compose ps"

echo "완료. health: curl -sS https://39-106-213-185.sslip.io/api/health"
