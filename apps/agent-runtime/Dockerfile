FROM node:22-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 && rm -rf /var/lib/apt/lists/*
RUN corepack enable

FROM base AS build
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json ./
COPY packages ./packages
COPY apps/agent-runtime ./apps/agent-runtime
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @crowcode/agent-runtime... build
RUN pnpm --filter @crowcode/agent-runtime deploy --prod --legacy /out

FROM base AS runtime
WORKDIR /app
ENV WORK_DIR=/workspace/repo
# The `claude` CLI refuses --dangerously-skip-permissions (permissionMode:
# 'bypassPermissions') when run as root, for its own safety reasons -- runs
# as the `node` user (built into the base image) instead, which is also
# just general Docker hygiene regardless of that specific requirement.
RUN mkdir -p /workspace/repo && chown -R node:node /workspace
COPY --from=build --chown=node:node /out ./
USER node
CMD ["node", "dist/index.js"]
