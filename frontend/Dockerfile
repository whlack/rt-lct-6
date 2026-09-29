FROM node:24-bookworm-slim AS development
WORKDIR /workspace
# The shared workspace installs Prisma too; align dependency prerequisites with backend.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile
COPY frontend frontend
COPY docs/templates docs/templates
WORKDIR /workspace/frontend
CMD ["pnpm", "dev"]

FROM development AS build
RUN pnpm build

FROM nginx:1.27-alpine AS production
# The official entrypoint renders only this variable at startup; Vite assets stay unchanged.
ENV API_UPSTREAM=http://backend:3000
ENV NGINX_ENVSUBST_FILTER=^API_UPSTREAM$
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /workspace/frontend/dist /usr/share/nginx/html
