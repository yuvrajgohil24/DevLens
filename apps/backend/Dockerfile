# ── Stage 1: Builder ─────────────────────────────────────────────────────────
# node:20-slim = Debian-based — has OpenSSL pre-installed (Alpine/musl breaks Prisma)
FROM node:20-slim AS builder

WORKDIR /app

# Install openssl for Prisma generate
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

# Copy package files and install ALL deps (dev included — needed for tsc + prisma)
COPY package.json ./
RUN npm install

# Copy source
COPY . .

# Generate Prisma client + compile TypeScript
RUN npx prisma generate --schema=prisma/schema.prisma
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
# Must also be slim/Debian so Prisma query engine binary works at runtime
FROM node:20-slim AS production

# Install OpenSSL + curl + git for Trivy/TruffleHog + scanning
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    curl \
    git \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

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

# Run DB schema push then start server (since we don't track a migrations folder)
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma --accept-data-loss && node dist/index.js"]
