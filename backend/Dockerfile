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
RUN pnpm prisma generate
CMD ["pnpm", "dev"]

# Migrations and test tooling are separate from application runtime images.
FROM development AS tooling
RUN pnpm build

FROM tooling AS runtime-dependencies
RUN pnpm --filter backend deploy --prod --legacy --frozen-lockfile /app

FROM node:24-bookworm-slim AS production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /workspace/backend
COPY --from=runtime-dependencies --chown=node:node /app ./
ENV NODE_ENV=production
USER node
CMD ["node", "dist/main.js"]

FROM dependencies AS worker-dependencies
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN pnpm exec playwright install --with-deps --only-shell chromium && apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*

FROM worker-dependencies AS worker-development
COPY backend /workspace/backend
COPY infra/keycloak/configure-client.mjs /workspace/infra/keycloak/configure-client.mjs
RUN pnpm prisma generate
CMD ["pnpm", "worker:dev"]

FROM node:24-bookworm-slim AS worker-production
ENV NODE_ENV=production PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
WORKDIR /workspace/backend
COPY --from=runtime-dependencies --chown=node:node /app ./
# Install system libraries without bundling the development workspace into runtime.
COPY --from=worker-dependencies /opt/playwright /opt/playwright
RUN node node_modules/playwright/cli.js install-deps chromium && apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
USER node
CMD ["node", "dist/worker.js"]
