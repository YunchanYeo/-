#!/usr/bin/env bash
# 맥에서: 레포 루트의 backend/.env → EC2 ~/wechat-mini/backend/.env 로 업로드 후 backend 재기동 안내
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_LOCAL="${REPO_ROOT}/backend/.env"
KEY="${EC2_SSH_KEY:-${HOME}/keys/ec2.pem}"
HOST="${EC2_HOST:-ec2-user@13.124.255.73}"
REMOTE_DIR="${EC2_REPO_DIR:-~/wechat-mini}"

if [[ ! -f "$ENV_LOCAL" ]]; then
  echo "없음: $ENV_LOCAL" >&2
  exit 1
fi
if [[ ! -f "$KEY" ]]; then
  echo "SSH 키 없음: $KEY (EC2_SSH_KEY 로 지정 가능)" >&2
  exit 1
fi

SSH_BASE=(/opt/homebrew/bin/ssh -F /dev/null -o StrictHostKeyChecking=accept-new
  -o PubkeyAcceptedAlgorithms=rsa-sha2-512,rsa-sha2-256,ssh-rsa
  -i "$KEY")

SCP_BASE=(scp -F /dev/null -o StrictHostKeyChecking=accept-new
  -o PubkeyAcceptedAlgorithms=rsa-sha2-512,rsa-sha2-256,ssh-rsa
  -i "$KEY")

# Homebrew ssh 없으면 PATH ssh 사용
if [[ ! -x "${SSH_BASE[0]}" ]]; then
  SSH_BASE=(ssh -F /dev/null -o StrictHostKeyChecking=accept-new
    -o PubkeyAcceptedAlgorithms=rsa-sha2-512,rsa-sha2-256,ssh-rsa -i "$KEY")
  SCP_BASE=(scp -F /dev/null -o StrictHostKeyChecking=accept-new
    -o PubkeyAcceptedAlgorithms=rsa-sha2-512,rsa-sha2-256,ssh-rsa -i "$KEY")
fi

echo "업로드: $ENV_LOCAL -> ${HOST}:${REMOTE_DIR}/backend/.env"
"${SCP_BASE[@]}" "$ENV_LOCAL" "${HOST}:${REMOTE_DIR}/backend/.env"

echo "원격에서 backend 재기동:"
echo "  ${SSH_BASE[*]} $HOST 'cd ${REMOTE_DIR}/deploy/ec2-al2023 && docker compose up -d --force-recreate backend'"
if [[ "${SYNC_REMOTE_NOW:-}" == "1" ]]; then
  "${SSH_BASE[@]}" "$HOST" "cd ${REMOTE_DIR}/deploy/ec2-al2023 && docker compose up -d --force-recreate backend"
fi
