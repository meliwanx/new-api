#!/usr/bin/env bash
#
# 快速打包并滚动部署到 onlymeok.com 集群（116 master + 58 node）。
#
# 本脚本不含任何密码，凭据通过环境变量传入（密码见本地未入库的 DEPLOYMENT.local.md）：
#   SSHPASS_MASTER='<116 root 密码>' SSHPASS_NODE='<58 root 密码>' ./scripts/deploy-onlymeok.sh
#
# 依赖：本地 sshpass / bun / tar；远端 docker + docker compose。
#
# 安全红线：本脚本只操作本站（cluster4）专属资源，绝不触碰集群上其它站点。
#
set -euo pipefail

MASTER=116.142.250.54
NODE=116.142.250.58
IMAGE=new-api-onlymeok:latest
BUILD_DIR=/root/new-api-onlymeok-src
SRC_TGZ=/tmp/new-api-onlymeok-src.tgz
IMG_TGZ=/tmp/new-api-onlymeok-image.tgz

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
TAG="$(git rev-parse --short HEAD 2>/dev/null || echo manual)"

: "${SSHPASS_MASTER:?需设置 SSHPASS_MASTER（116 root 密码）}"
: "${SSHPASS_NODE:?需设置 SSHPASS_NODE（58 root 密码）}"
command -v sshpass >/dev/null || { echo "缺少 sshpass，请先安装"; exit 1; }
command -v bun >/dev/null     || { echo "缺少 bun，请先安装"; exit 1; }

SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=20)
sshm() { sshpass -p "$SSHPASS_MASTER" ssh "${SSH_OPTS[@]}" "root@$MASTER" "$@"; }
sshn() { sshpass -p "$SSHPASS_NODE" ssh "${SSH_OPTS[@]}" "root@$NODE" "$@"; }
scp_with_fallback() {
  local pass="$1"
  shift
  if ! sshpass -p "$pass" scp "${SSH_OPTS[@]}" "$@"; then
    echo "    scp/SFTP 不可用，回退 legacy scp (-O)"
    sshpass -p "$pass" scp -O "${SSH_OPTS[@]}" "$@"
  fi
}
scpm() { scp_with_fallback "$SSHPASS_MASTER" "$@"; }
scpn() { scp_with_fallback "$SSHPASS_NODE" "$@"; }

echo "==> [1/6] 本地构建前端（web/default）"
( cd web/default && bun run build )

echo "==> [2/6] 打包源码（含 dist + Dockerfile.deploy，剔除 .git/node_modules）"
rm -f "$SRC_TGZ"
tar czf "$SRC_TGZ" \
  --exclude='./.git' \
  --exclude='./web/default/node_modules' \
  --exclude='./web/classic/node_modules' \
  --exclude='./node_modules' \
  --exclude='./new-api' \
  --exclude='./logs' \
  .

echo "==> [3/6] 上传并在 116 构建镜像 $IMAGE (tag: $TAG)"
scpm "$SRC_TGZ" "root@$MASTER:$SRC_TGZ"
sshm "set -e
  rm -rf $BUILD_DIR && mkdir -p $BUILD_DIR
  tar xzf $SRC_TGZ -C $BUILD_DIR
  cd $BUILD_DIR
  [ -f .dockerignore ] && sed -i '/dist/d' .dockerignore || true
  docker build -f Dockerfile.deploy -t $IMAGE -t new-api-onlymeok:$TAG ."

echo "==> [4/6] 滚动更新 master(116)"
sshm "cd /opt/newapi-cluster4 && docker compose up -d"

echo "==> [5/6] 分发镜像到 node(58) 并滚动更新"
if sshm "ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=8 root@$NODE true" 2>/dev/null; then
  echo "    116→58 免密可用，内网直传镜像"
  sshm "docker save $IMAGE | gzip | ssh -o StrictHostKeyChecking=no root@$NODE 'gunzip | docker load'"
else
  echo "    116→58 无免密，回退「116→本地→58」中转"
  sshm "docker save $IMAGE | gzip > $IMG_TGZ"
  rm -f "$IMG_TGZ"
  scpm "root@$MASTER:$IMG_TGZ" "$IMG_TGZ"
  scpn "$IMG_TGZ" "root@$NODE:$IMG_TGZ"
  sshn "gunzip -c $IMG_TGZ | docker load"
fi
sshn "cd /opt/newapi-cluster4-node && docker compose up -d"

echo "==> [6/6] 健康检查"
sleep 6
sshm "curl -s -o /dev/null -w 'master=%{http_code}\n' http://127.0.0.1:3103/api/status
  curl -s -o /dev/null -w 'node=%{http_code}\n'   http://$NODE:3103/api/status
  curl -s --resolve onlymeok.com:443:$MASTER -o /dev/null -w 'domain=%{http_code}\n' https://onlymeok.com/api/status"

echo "✅ 部署完成：$IMAGE (tag: $TAG)"
