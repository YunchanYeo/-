# 微信小程序 · 백엔드 배포 참고 (일반)

레포에 **고정 ECS 경로·`deploy/china-test` 번들은 포함하지 않습니다.** 실제 서버 경로·compose 위치는 본인 인프라에 맞게 잡으면 됩니다.

**위챗 네트워크 규정**: https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html

---

## 1. 구성 요소

- **backend**: Express API (기본 포트 3000)
- **admin-web**: Vite 빌드 정적 파일 + nginx (`/api` → 백엔드 프록시는 nginx 설정에서 구성)
- **frontend**: 미니프로그램 — 위챗 개발자도구에서 `frontend` 열기

외부 공개 시에는 **HTTPS** 와 위챗 **服务器域名** 등록이 필요합니다.

---

## 2. 방화벽(예시)

VPS·클라우드 방화벽에서 흔히 여는 포트:

- **22** SSH
- **80** / **443** 웹·Let’s Encrypt 등
- **3000** 백엔드 직접 점검용(운영에서는 막아도 됨)

---

## 3. Docker(자체 compose)

1. 서버에 Docker 설치 후, 레포의 `backend/`·`admin-web/` 를 **build context** 로 하는 `docker-compose.yml` 을 **직접 작성**합니다.
2. `backend/.env` 는 Git 에 올리지 말고, 컨테이너에는 `env_file` 또는 환경 변수로 주입합니다.
3. `.env` 만 바꾼 뒤 반영하려면 백엔드 컨테이너를 **재생성**하는 편이 안전합니다.

```bash
docker compose up -d --no-deps --force-recreate backend
```

`restart` 만으로는 환경 변수가 남는 경우가 있어, 위와 같이 **재생성**을 권장합니다.

---

## 4. 微信支付 인증서

`backend/certs/wechat-pay/README.md` 참고.

---

## 5. 微信小程序 — API 주소 (`frontend/config/runtime.js` / `index.js`)

- **`CLOUD_HTTPS_API_BASE`**: 실제 API HTTPS 루트(끝 `/` 없음). **微信公众平台 → 服务器域名 → request合法域名** 에 넣은 **호스트**와 일치해야 합니다.
- **`CLOUD_HTTPS_API_BASE_OVERRIDE`**: 임시로 다른 HTTPS 루트를 쓸 때만. 비우면 기본값 사용.
- **`CLOUD_HTTP_API_BASE`**: 개발자도구에서 **不校验合法域名** 사용 시 HTTP로 붙는 백엔드 주소. 기본값은 `http://127.0.0.1:3000` 입니다. **공인 IP:3000** 을 쓰면, 같은 IP로부터 **sslip** 후보 URL(`https://x-x-x-x.sslip.io` 형태)을 자동으로 프로브 체인에 넣을 수 있습니다(해당 호스트도 mp 백오피스에 등록).
- **`project.config.json` 의 `appid`** 와 `backend/.env` 의 WeChat AppID 가 동일한小程序 인지 확인합니다.

`wx.request` 용도로 `frontend/services/_utils/wxRequestTransport.js` 에 **HTTP/2·QUIC 비활성** 옵션이 들어 있을 수 있습니다.

---

## 6. Caddy / nginx

- TLS 종료는 **Caddy·nginx·클라우드 로드밸런서** 등 본인 스택에 맞게 구성합니다.
- 위챗 일부 단말에서 QUIC 이슈가 있으면, **HTTP/3 비활성**·**TLS 1.2** 등을 검토합니다(과거 `china-test` Caddyfile 에 있던 완화와 유사).

---

## 7. 정식 도메인

1. DNS **A 레코드**를 API 서버 공인 IP 로 맞춥니다.  
2. **微信公众平台 → 服务器域名** 에 호스트 등록(`https://` 없이). web-view(支付宝 등) 쓰면 **业务域名** 도 필요할 수 있습니다.  
3. (중국 본토 대외 서비스 시) **ICP备案** 등은 호스팅·정책에 따라 별도 확인합니다.

**AWS EC2 + Caddy + 예시 도메인 `hebibingtest.shop`:** 단계별 절차는 **`docs/kr/DEPLOY_EC2_HEBIBINGTEST.md`** · `deploy/ec2-al2023/README.md` 를 참고하세요.

`CUSTOM_DOMAIN_CHINA.md` 는 본 문서와 중복 안내용 링크만 유지합니다.

---

## 8. 무료/임시 호스트 (DuckDNS·sslip 등)

- **DuckDNS** 등: A 레코드를 공인 IP에 맞춘 뒤, 같은 호스트로 TLS 인증서를 발급·`CLOUD_HTTPS_API_BASE`·公众平台를 맞춥니다.  
- **sslip.io**: IP 옥텟을 하이픈으로 바꾼 호스트가 DNS로 IP에 해석됩니다. 위챗이 해당 호스트를 허용하는지는 정책·시기에 따라 다릅니다.

---

## 9. Cloudflare Quick Tunnel (임시)

`cloudflared tunnel --url http://127.0.0.1:8080` 등으로 나온 `https://....trycloudflare.com` 을 公众平台 + `CLOUD_HTTPS_API_BASE_OVERRIDE` 에 넣을 수 있습니다. 주소는 세션마다 바뀔 수 있습니다.

---

## 10. OSS / PostgreSQL

- OSS·`migrate:oss`·PostgreSQL: **`docs/kr/ADMIN_MEDIA_SESSIONS.md`**, **`docs/kr/DEV_GUIDE.md`** §2-1.

---

## 11. 문제 요약

| 증상 | 조치 |
|------|------|
| 폰만 `request:fail` | 合法域名·`apiBaseUrl` 호스트·AppID·**清缓存 → 编译 → 新预览 QR** |
| TLS/인증서 오류 | 서버에서 `openssl s_client` 또는 브라우저로 해당 호스트:443 확인 |
| 관리자 이미지 미리보기 실패 | `PUBLIC_UPLOAD_BASE_URL`·**download合法域名**·`GET /api/media/product/:id` 배포 여부 확인 |

---

## 12. git pull 이 서버에서 막힐 때

서버에서 직접 수정한 추적 파일이 있으면 `git pull` 이 거부될 수 있습니다. `stash` / 정리 후 `pull`, 또는 필요한 파일만 `scp` 등으로 반영합니다.
