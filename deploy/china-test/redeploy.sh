#!/usr/bin/env bash
# 在项目根目录已 git pull 之后，于服务器上执行：
#   bash deploy/china-test/redeploy.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT/deploy/china-test"
echo "[redeploy] docker compose up -d --build ..."
docker compose up -d --build
echo ""
docker compose ps
echo "[redeploy] ok"
