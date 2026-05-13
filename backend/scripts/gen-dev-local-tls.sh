#!/usr/bin/env bash
# 로컬 HTTPS（小程序 wx-image / 新版组件要求 HTTPS）— OpenSSL 자체 서명 인증서
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/certs/dev-local"
mkdir -p "$DIR"
if openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout "$DIR/key.pem" \
  -out "$DIR/cert.pem" \
  -days 825 \
  -subj "/CN=127.0.0.1" \
  -addext "subjectAltName=IP:127.0.0.1,DNS:localhost" 2>/dev/null; then
  :
else
  openssl req -x509 -newkey rsa:2048 -nodes \
    -keyout "$DIR/key.pem" \
    -out "$DIR/cert.pem" \
    -days 825 \
    -subj "/CN=127.0.0.1"
fi
echo "[gen-dev-local-tls] wrote $DIR/key.pem + cert.pem — restart backend (npm run start)"
