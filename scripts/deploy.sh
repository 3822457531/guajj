#!/usr/bin/env bash
# 在服务器项目根目录执行：bash scripts/deploy.sh
# 分支：GIT_BRANCH=main bash scripts/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

BRANCH="${GIT_BRANCH:-main}"
REMOTE="${GIT_REMOTE:-origin}"

echo ">>> git pull $REMOTE $BRANCH"
git fetch "$REMOTE"
git checkout "$BRANCH"
git pull "$REMOTE" "$BRANCH"

echo ">>> npm ci"
npm ci

echo ">>> npm run db:migrate（同步数据库结构，部署必跑）"
npm run db:migrate

echo ">>> npm run build（内含 prisma generate）"
npm run build

echo ">>> 重启进程"
if command -v pm2 >/dev/null 2>&1; then
  pm2 restart chigua-web 2>/dev/null || pm2 start npm --name chigua-web -- start
else
  echo "未检测到 pm2，请手动执行：pm2 restart <名称> 或 systemctl restart <服务>"
fi

echo ">>> 部署完成"
