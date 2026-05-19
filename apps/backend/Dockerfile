# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files and install ALL deps (dev included — needed for tsc + prisma)
# Using npm install instead of npm ci: no package-lock.json in this monorepo subfolder
COPY package.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client + compile TypeScript
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine AS production

# Install system dependencies needed by Trivy + TruffleHog + git clone
RUN apk add --no-cache \
    curl \
    git \
    bash \
    ca-certificates \
    && update-ca-certificates

# Install Trivy (CVE scanner)
RUN curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh \
    | sh -s -- -b /usr/local/bin

# Install TruffleHog (secret scanner)
RUN curl -sSfL https://raw.githubusercontent.com/trufflesecurity/trufflehog/main/scripts/install.sh \
    | sh -s -- -b /usr/local/bin

WORKDIR /app

# Copy built artifacts from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# Expose backend port
EXPOSE 4000

# Run DB migration then start server
CMD ["sh", "-c", "npx prisma migrate deploy --schema=prisma/schema.prisma && node dist/index.js"]
