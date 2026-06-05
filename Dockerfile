# Node 20 on Debian bookworm（与 CentOS7 宿主机 glibc 无关，在容器内运行）
# 本镜像为生产：CMD 使用 next start，无热更新。本地开发请在本机执行 npm run dev（或 dev:poll）。
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# 监听 0.0.0.0 以便宿主机/Nginx 访问容器端口。
# 大视频上传：除应用内 ADMIN_UPLOAD_MAX_MB 外，若经 Nginx 反代，须提高 client_max_body_size（默认常仅 1m，会 413）。
CMD ["npx", "next", "start", "--hostname", "0.0.0.0", "-p", "3000"]
