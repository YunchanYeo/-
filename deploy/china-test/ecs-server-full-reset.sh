#!/usr/bin/env bash
# 「서버 완전 초기화」 전용 래퍼 — Docker 볼륨(SQLite·Caddy 등)까지 삭제 후 재빌드.
# 실제 로직은 ecs-full-rebuild-from-repo.sh 의 SERVER_FULL_RESET 모드.
#
# 첫 실행 시 확인 문자열 없으면 안내 메시지만 출력하고 종료합니다.
#
#   ssh root@39.106.213.185
#   bash /root/wechat-app/deploy/china-test/ecs-server-full-reset.sh
#
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec env SERVER_FULL_RESET=1 bash "$DIR/ecs-full-rebuild-from-repo.sh"
