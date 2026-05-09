#!/usr/bin/env bash
# 레포 루트에서: bash deploy/china-test/redeploy.sh
# ECS 예: cd /root/wechat-app-live && bash deploy/china-test/redeploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/deploy/china-test"
echo "[redeploy] docker compose up -d --build ..."
docker compose up -d --build
echo ""
docker compose ps
echo "[redeploy] Caddy 로그 (최근 30줄) …"
docker compose logs --tail=30 caddy 2>/dev/null || true
echo "[redeploy] ok — 브라우저·미니프로그램은 https://(sslip 또는 정식 도메인) 만 사용 (공인 :8080 없음)"
