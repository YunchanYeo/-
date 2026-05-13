# EC2 (Amazon Linux 2023) + Docker + Caddy

`docker-compose.yml` 은 **레포 루트의 `backend/`·`admin-web/`** 를 빌드하고, **Caddy** 가 `Caddyfile` 의 호스트명으로 TLS(Let’s Encrypt)를 발급한 뒤 **admin-web(nginx)** 로 넘깁니다. nginx 가 `/api`·`/uploads` 를 **backend:3000** 으로 프록시합니다.

현재 `Caddyfile` 의 도메인은 **`hebibingtest.shop`** 입니다. 바꾸려면 `Caddyfile` 과 `backend.env` 의 공개 URL·위챗 알림 URL·DNS 를 함께 맞추세요.

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

## 4) `backend.env`

```bash
cd ~/wechat-mini/deploy/ec2-al2023
cp backend.env.example backend.env
nano backend.env   # 또는 vi
```

`WECHAT_APPID` 등 `backend/.env.example` 에 있는 항목을 운영 값으로 채웁니다.  
로컬에서 이미 쓰는 `backend/.env` 가 있으면, **민감 정보 검토 후** 이 디렉터리에 `backend.env` 로 복사해도 됩니다.

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
