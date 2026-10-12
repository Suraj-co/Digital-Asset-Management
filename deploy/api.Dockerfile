# Build context is the repository root.
# This image was not built in the workspace that added the file. Docker was not installed there.
FROM node:22.23.3-bookworm-slim

WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.33.4 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @aaradhya/api build

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 43124
CMD ["node", "scripts/start-release.mjs"]
