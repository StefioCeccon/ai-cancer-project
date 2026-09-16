# syntax=docker/dockerfile:1
# Build from repo root:
#   docker build -f apps/web/Dockerfile -t open-cancer-ai-web .

FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .nvmrc ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Build-time placeholders so Next can compile; real values come at runtime.
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_placeholder
ENV CLERK_SECRET_KEY=sk_placeholder
RUN pnpm --filter web build

# One-shot migrate target: docker compose runs this before web.
FROM builder AS migrate
WORKDIR /app/apps/web
CMD ["pnpm", "exec", "drizzle-kit", "migrate"]

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

RUN mkdir -p ./apps/web/public/uploads \
  && chown -R nextjs:nodejs ./apps/web/public/uploads

USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
