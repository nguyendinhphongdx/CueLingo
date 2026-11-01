# syntax=docker/dockerfile:1
# Build from the repo root:  docker build -f services/workers/Dockerfile -t cuelingo-workers .
FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2 prune @cuelingo/workers --docker

FROM base AS deps
COPY --from=prune /repo/out/json/ .
RUN pnpm install --frozen-lockfile

FROM deps AS runner
COPY --from=prune /repo/out/full/ .
ENV NODE_ENV=production
USER node
CMD ["pnpm", "--filter", "@cuelingo/workers", "start"]
