FROM node:24-bookworm-slim AS dependencies
WORKDIR /workspace
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN pnpm install --frozen-lockfile
WORKDIR /workspace/backend

FROM dependencies AS development
COPY backend /workspace/backend
COPY infra/keycloak/configure-client.mjs /workspace/infra/keycloak/configure-client.mjs
WORKDIR /workspace/backend
RUN pnpm prisma generate
CMD ["pnpm", "dev"]

FROM development AS production
RUN pnpm build
CMD ["pnpm", "start:prod"]

FROM dependencies AS worker-dependencies
RUN pnpm exec playwright install --with-deps --only-shell chromium && apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

FROM worker-dependencies AS worker-development
COPY backend /workspace/backend
COPY infra/keycloak/configure-client.mjs /workspace/infra/keycloak/configure-client.mjs
RUN pnpm prisma generate
CMD ["pnpm", "worker:dev"]

FROM worker-development AS worker-production
RUN pnpm build
CMD ["pnpm", "worker:prod"]
