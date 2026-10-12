# DevLens backend image.
#
# BUILD CONTEXT IS THE REPOSITORY ROOT (the npm workspace lockfile lives there):
#   docker build -f apps/backend/Dockerfile .
#
# The same image runs the API (default CMD) or a standalone scan worker
# (`node dist/worker.js`).

ARG NODE_IMAGE=node:20-slim

# ── Base: Debian slim (Alpine/musl breaks Prisma) + OpenSSL for Prisma ────────
FROM ${NODE_IMAGE} AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ── Build: all backend deps from the lockfile, compile TypeScript ─────────────
FROM base AS build
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --workspace=apps/backend --include-workspace-root=false --no-audit --no-fund
COPY apps/backend/ apps/backend/
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma \
    && npm run build --workspace=apps/backend

# ── Production deps only (prisma CLI is a runtime dep for migrations) ─────────
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN npm ci --workspace=apps/backend --include-workspace-root=false --omit=dev --no-audit --no-fund \
    && npm cache clean --force
COPY apps/backend/prisma apps/backend/prisma
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM base AS production

# Scanner versions are pinned; the install scripts are fetched from the same tag
# and verify the release tarball's SHA-256 checksum. Bump deliberately.
ARG TRIVY_VERSION=v0.74.0
ARG TRUFFLEHOG_VERSION=v3.97.9
RUN apt-get update \
    && apt-get install -y --no-install-recommends git curl \
    && curl -sSfL "https://raw.githubusercontent.com/aquasecurity/trivy/${TRIVY_VERSION}/contrib/install.sh" \
       | sh -s -- -b /usr/local/bin "${TRIVY_VERSION}" \
    && curl -sSfL "https://raw.githubusercontent.com/trufflesecurity/trufflehog/${TRUFFLEHOG_VERSION}/scripts/install.sh" \
       | sh -s -- -b /usr/local/bin "${TRUFFLEHOG_VERSION}" \
    && apt-get purge -y curl && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/* \
    && trivy --version && trufflehog --version

ENV NODE_ENV=production
WORKDIR /app

# Whole workspace tree: deps may be hoisted to /app/node_modules or nested under apps/backend
COPY --from=prod-deps --chown=node:node /app ./
COPY --from=build --chown=node:node /app/apps/backend/dist ./apps/backend/dist

WORKDIR /app/apps/backend
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# Apply migrations (baselines old `db push` databases), then start the API.
# `exec` replaces the shell so node receives SIGTERM directly (graceful shutdown).
CMD ["sh", "-c", "node dist/scripts/migrate.js && exec node dist/index.js"]
