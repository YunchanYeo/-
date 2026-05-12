#!/usr/bin/env bash
# 미니프로그램 request 合法域名으로 쓰는 HTTPS 호스트 일괄 점검 (ECS 또는 맥에서 실행).
# 각 호스트: TLS + GET /api/health (admin-web nginx → backend:3000)
# 사용: bash deploy/china-test/check-mp-https-hosts.sh
set -u
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOSTS=(
  "hebibingtest.shop"
  "39-106-213-185.sslip.io"
  "39.106.213.185.nip.io"
)
for h in "${HOSTS[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  bash "${DIR}/check-ssl.sh" "$h" || true
done
echo ""
echo "=== 微信公众平台 request合法域名 (스킴·경로 없이 호스트만) ==="
printf '%s\n' "${HOSTS[@]}"
