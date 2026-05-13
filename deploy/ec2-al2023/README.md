# EC2 (Amazon Linux 2023) + Docker + Caddy

`docker-compose.yml` 은 **레포 루트의 `backend/`·`admin-web/`** 를 빌드하고, **Caddy** 가 `Caddyfile` 의 호스트명으로 TLS(Let’s Encrypt)를 발급한 뒤 **admin-web(nginx)** 로 넘깁니다. nginx 가 `/api`·`/uploads` 를 **backend:3000** 으로 프록시합니다.

현재 `Caddyfile` 은 점검용 **`*.sslip.io`** 등으로 열 수 있습니다. 호스트를 바꾸면 `Caddyfile` 과 **`backend/.env`** 의 공개 URL(`PUBLIC_*` / 알림 URL)·DNS 를 함께 맞추세요.

## 1) EC2 준비

- 인스턴스: Amazon Linux 2023
- 보안 그룹: **22**(SSH), **80**, **443** 인바운드 허용
- (선택) Elastic IP 부여 후 DNS A 레코드에 고정

## 2) 서버에 Docker + Compose v2 설치

```bash
sudo dnf update -y
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
```

Amazon Linux 2023 기본 저장소에는 **`docker-compose-plugin` RPM 이 없을 수 있어** `dnf install docker-compose-plugin` 이 실패하는 경우가 흔합니다. 그때는 **공식 바이너리**(Docker CLI 플러그인)로 설치합니다.

```bash
# x86_64 / aarch64 공통: GitHub 릴리스 파일명과 uname -m 이 맞아야 함
sudo mkdir -p /usr/local/lib/docker/cli-plugins
ARCH=$(uname -m)
case "$ARCH" in
  x86_64) COMPOSE_ARCH=x86_64 ;;
  aarch64) COMPOSE_ARCH=aarch64 ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac
sudo curl -fsSL "https://github.com/docker/compose/releases/download/v2.40.3/docker-compose-linux-${COMPOSE_ARCH}" \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
docker compose version
```

`curl: (22) ... 404` 이면 **태그/파일명이 틀린 것**입니다. 존재하는 버전은 [compose releases](https://github.com/docker/compose/releases) 의 **v2.x** 태그를 확인하세요. (예: `v2.40.3`)

**로그아웃 후 다시 SSH** 해서 `docker` 그룹이 적용되게 하세요. 적용 전에는 `sudo docker compose ...` 로 실행해도 됩니다.

### 2b) Docker Buildx (필수에 가깝게 권장)

`docker compose up --build` 시 **`compose build requires buildx 0.17 or later`** 가 나오면, `dnf` 로 깐 Docker 에 포함된 **buildx 가 너무 오래된 것**입니다. 아래로 **Buildx CLI 플러그인**을 설치하세요.

```bash
sudo mkdir -p /usr/local/lib/docker/cli-plugins
ARCH=$(uname -m)
case "$ARCH" in
  x86_64)  BUILDX_URL="https://github.com/docker/buildx/releases/download/v0.34.0/buildx-v0.34.0.linux-amd64" ;;
  aarch64) BUILDX_URL="https://github.com/docker/buildx/releases/download/v0.34.0/buildx-v0.34.0.linux-arm64" ;;
  *) echo "Unsupported arch: $ARCH"; exit 1 ;;
esac
sudo curl -fsSL "$BUILDX_URL" -o /usr/local/lib/docker/cli-plugins/docker-buildx
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-buildx
docker buildx version
```

그다시 `cd ~/wechat-mini/deploy/ec2-al2023` 후 `docker compose up -d --build` 를 실행합니다.

## 3) 레포 클론·경로

서버 경로는 **ASCII만** 권장 (예: `~/wechat-mini`).

```bash
mkdir -p ~/wechat-mini && cd ~/wechat-mini
git clone <본인_레포_URL> .
```

## 4) `backend/.env` (로컬과 동일 파일)

`docker-compose.yml` 은 **`../../backend/.env`** 만 컨테이너에 넘깁니다. `deploy/ec2-al2023/backend.env` 는 쓰지 않습니다.

```bash
cd ~/wechat-mini
# 템플릿이 없을 때만
cp deploy/ec2-al2023/backend.env.example backend/.env
nano backend/.env
```

`WECHAT_APPID` 등은 `backend/.env.example` 과 동일 항목을 채웁니다.  
**관리자 로그인:** `ADMIN_USERNAME`·`ADMIN_PASSWORD` 가 비어 있으면 최초 관리자가 만들어지지 않습니다.  
기동 시 `admins` 가 비어 있지 않아도 **`.env` 의 사용자명이 DB에 없으면 자동으로 한 명 추가**합니다. 비밀번호만 `.env` 와 맞추려면 `ADMIN_SYNC_ON_START=true` 로 한 번 기동한 뒤 `false` 로 되돌리세요.  
맥에서 이미 쓰는 `backend/.env` 를 EC2 로 올리려면 (키 기본 `~/keys/ec2.pem`, 호스트 기본 `ec2-user@13.124.255.73`):

```bash
cd /path/to/微信小程序
./deploy/ec2-al2023/sync-backend-env.sh
# 한 번에 재기동까지: SYNC_REMOTE_NOW=1 ./deploy/ec2-al2023/sync-backend-env.sh
```

환경 변수: `EC2_SSH_KEY`, `EC2_HOST`, `EC2_REPO_DIR`(기본 `~/wechat-mini`).

## 5) 기동

레포 루트가 아니라 **이 디렉터리에서**:

```bash
cd ~/wechat-mini/deploy/ec2-al2023
docker compose up -d --build
```

- 첫 TLS 발급까지 **1~2분** 걸릴 수 있습니다.
- 로그: `docker compose logs -f caddy` / `docker compose logs -f backend`

## 6) DNS

도메인 관리 콘솔에서 **`hebibingtest.shop` A 레코드** → EC2 **퍼블릭 IPv4**(또는 Elastic IP).

## 7) 갱신(코드 배포)

```bash
cd ~/wechat-mini && git pull
cd deploy/ec2-al2023 && docker compose up -d --build
```

`.env` 만 바꾼 경우 백엔드 재생성:

```bash
docker compose up -d --no-deps --force-recreate backend
```

## 8) 상세 체크리스트

미니프로그램·위챗公众平台·`runtime.js` 설정은 **`docs/kr/DEPLOY_EC2_HEBIBINGTEST.md`** 를 따르세요.
