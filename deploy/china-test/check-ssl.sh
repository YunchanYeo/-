#!/usr/bin/env bash
# ECS 등에서 실행: TLS/SNI·간단 HTTP 확인. 인자 없으면 운영 도메인 기본.
# 맥(LibreSSL)의 openssl s_client 는 -brief 옵션이 없음 — 이 스크립트는 -brief 미사용.
# 사용: bash check-ssl.sh
#       bash check-ssl.sh hebibingtest.shop
#       bash check-ssl.sh 39-106-213-185.sslip.io
set -euo pipefail
HOST="${1:-hebibingtest.shop}"
echo "=== check-ssl: ${HOST}:443 ==="
echo "--- openssl: subject / issuer / dates ---"
if echo | openssl s_client -connect "${HOST}:443" -servername "${HOST}" 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates 2>/dev/null; then
  :
else
  echo "(openssl 실패: 방화벽·DNS·443 미개방 가능)"
fi
echo "--- openssl: chain 줄(일부) ---"
echo | openssl s_client -connect "${HOST}:443" -servername "${HOST}" -showcerts 2>/dev/null \
  | grep -E '^(Certificate chain| s:|i:)' | head -25 || true
echo "--- curl GET /api/health (IPv4) ---"
curl -4sS -w "\nhttp_code=%{http_code} time=%{time_total}s\n" -o /tmp/check-ssl-body.txt \
  "https://${HOST}/api/health" || true
head -c 300 /tmp/check-ssl-body.txt 2>/dev/null || true
echo ""
echo "=== 다음 ==="
echo "1) 브라우저: https://myssl.com/ssl.html?domain=${HOST}"
echo "2) 위챗만 실패하면: 인증서 체인 '불완전' 여부 확인 후 Caddy/인증서 fullchain 재배포"
echo "3) 정식 도메인: DNS A 레코드 → 이 서버 IP, Caddyfile에 블록 추가, CLOUD_HTTPS_API_BASE_OVERRIDE 설정"
