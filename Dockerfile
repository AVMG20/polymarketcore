# Bun end to end: install, build and serve. See CLAUDE.md ("Runtime") for the
# build memory numbers; the Nitro output uses the `bun` preset.
FROM oven/bun:1.4-alpine AS builder

WORKDIR /app

COPY package.json bun.lock ./
# postinstall (`nuxt prepare`) needs the app sources; `nuxt build` redoes it anyway.
RUN bun install --frozen-lockfile --ignore-scripts

COPY . .
# SENTRY_AUTH_TOKEN (optional, a build secret so it stays out of the image): uploads the browser
# source maps to Rustrak (modules/sentry-sourcemaps.ts). Without it the build skips the upload.
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN bun --bun nuxt build


FROM oven/bun:1.4-alpine

WORKDIR /app

# Migrations run at container start (they need the live database). Only the
# migration toolchain is installed here, pinned to the versions in bun.lock.
RUN bun add drizzle-kit@0.31.11 drizzle-orm@0.45.4 pg@8.23.1

COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY server/database/schema.ts ./server/database/schema.ts
COPY --chmod=755 docker-entrypoint.sh ./
COPY --from=builder /app/.output ./.output

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1

USER bun

ENTRYPOINT ["/app/docker-entrypoint.sh"]
