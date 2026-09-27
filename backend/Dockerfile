FROM node:24-bookworm-slim AS development
WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY backend backend
COPY infra/keycloak/configure-client.mjs /workspace/infra/keycloak/configure-client.mjs
WORKDIR /workspace/backend
RUN pnpm prisma generate
CMD ["pnpm", "dev"]

FROM development AS production
RUN pnpm build
CMD ["pnpm", "start:prod"]
