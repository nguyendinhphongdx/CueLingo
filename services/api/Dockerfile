# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f services/api/Dockerfile -t cuelingo-api .
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

# 1) Keep only @cuelingo/api and the workspace packages it depends on.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2 prune @cuelingo/api --docker

# 2) Install dependencies from the pruned manifests (cached until a package.json changes).
FROM base AS deps
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile

# 3) Add the sources and run. tsx runs the TypeScript directly (ADR-0001: no build step in the MVP).
FROM deps AS runner
COPY --from=prune /repo/out/full/ .
ENV NODE_ENV=production
USER node
EXPOSE 4000
CMD ["pnpm", "--filter", "@cuelingo/api", "start"]
