#!/usr/bin/env bash
# 정식 HTTPS 도메인을 Caddyfile에 추가하고, 公众平台·프론트·.env 후속 작업을 안내합니다.
#
# 사용법 (서버에서, deploy/china-test 디렉터리 또는 레포 어디서든):
#   CUSTOM_DOMAIN=api.你的域名.com bash deploy/china-test/enable-public-domain.sh
#   또는
#   bash deploy/china-test/enable-public-domain.sh api.你的域名.com
#
# 전제: DNS A 레코드가 이미 이 ECS 공인 IP를 가리키는 것이 좋습니다(없으면 Caddy Let's Encrypt 발급 실패).
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE}[0]}")" && pwd)"
CADDY_FILE="$HERE/Caddyfile"

DOMAIN="${CUSTOM_DOMAIN:-${1:-}}"
if [[ -z "$DOMAIN" ]]; then
  echo "用法: CUSTOM_DOMAIN=api.example.com bash $0"
  echo "  或: bash $0 api.example.com"
  exit 1
fi

if [[ "$DOMAIN" =~ ^https?:// || "$DOMAIN" == *"/"* ]]; then
  echo "错误: 只填主机名，不要含 https:// 或路径。例: api.example.com"
  exit 1
fi

DOMAIN_DOT_ESC="${DOMAIN//./\\.}"

if grep -qE "^${DOMAIN_DOT_ESC}[[:space:]]*\\{" "$CADDY_FILE" 2>/dev/null; then
  echo "[ok] Caddyfile 已有站点块: $DOMAIN"
else
  cat >>"$CADDY_FILE" <<EOF

# —— 正式域名（enable-public-domain.sh 追加）——
# 与 微信公众平台 request合法域名 一致；与 frontend CLOUD_HTTPS_API_BASE_OVERRIDE 一致
$DOMAIN {
	tls {
		protocols tls1.2 tls1.3
	}
	reverse_proxy admin-web:80
}
EOF
  echo "[ok] 已追加 Caddy 站点: $DOMAIN"
fi

echo ""
echo "━━━━━━━━ 接下来请你手动完成 ━━━━━━━━"
echo "1) DNS: A 记录 $DOMAIN → 本机公网 IP（dig +short $DOMAIN 确认）"
echo "2) 重启 Caddy 申请证书:"
echo "     cd \"$HERE\" && docker compose restart caddy && docker compose logs --tail=40 caddy"
echo "3) backend/.env 设置（支付宝 return、web-view 等需要公网根地址）:"
echo "     API_PUBLIC_BASE_URL=https://$DOMAIN"
echo "     （若用 OSS 直链，download 合法域名另加 OSS 主机）"
echo "4) frontend/config/index.js 设置:"
echo "     CLOUD_HTTPS_API_BASE_OVERRIDE = 'https://$DOMAIN'"
echo "5) https://mp.weixin.qq.com → 开发设置 → 服务器域名:"
echo "     request合法域名 / download合法域名 / web-view业务域名(若用) → 填 $DOMAIN （无 https://）"
echo "6) 微信开发者工具: 清缓存 → 重新编译 → 新预览二维码"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
