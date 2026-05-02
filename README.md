# DevLens — Unified Developer Platform

> **Code → Deploy → Monitor → Secure** in one platform.

## Architecture

```
GitHub Push → GitHub Actions → POST /api/webhooks/pipeline
                                    ↓
                              PostgreSQL (deployment record)
                                    ↓
                              Redis BullMQ (scan job)
                                    ↓
                              Trivy scanner (mock → real in Phase 2)
                                    ↓
                              CVE records + Risk Score
                                    ↓
                              Socket.io → Dashboard live update
```

## Quick Start

### Prerequisites
- **Docker Desktop** must be running
- Node.js 20+, npm 10+

### 1. Start the database + Redis
```bash
docker-compose up -d
```

### 2. Install all dependencies
```bash
npm install          # root (concurrently)
cd apps/backend && npm install
cd apps/frontend && npm install
```

### 3. Push schema + seed data
```bash
cd apps/backend
npx prisma db push
npx ts-node prisma/seed.ts
```

### 4. Start both servers
```bash
# Terminal 1 — Backend (port 4000)
cd apps/backend && npm run dev

# Terminal 2 — Frontend (port 3000)
cd apps/frontend && npm run dev
```

### 5. Open the dashboard
```
http://localhost:3000
```

### 6. Test the webhook (new Terminal)
```bash
curl -X POST http://localhost:4000/api/webhooks/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "commit_sha": "a1b2c3d4e5f6a1b2",
    "service_name": "auth-api",
    "branch": "main",
    "author": "dev@example.com",
    "status": "running",
    "environment": "production",
    "commit_message": "feat: add JWT refresh tokens"
  }'
```

Watch the dashboard update live — deployment created, scan runs, CVEs appear, risk score updates.

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js 20, Express 5, TypeScript |
| ORM | Prisma 5 + PostgreSQL 16 |
| Queue | BullMQ + Redis 7 |
| Real-time | Socket.io |
| Frontend | Next.js 15, TailwindCSS, shadcn/ui |
| Charts | Recharts |
| Scanner | Trivy (mock Phase 1, real Phase 2) |

## API Endpoints

```
POST   /api/webhooks/pipeline          ← core flow entry
GET    /api/dashboard/overview
GET    /api/deployments?env=&status=
GET    /api/deployments/:id
GET    /api/vulnerabilities?severity=&resolved=
PATCH  /api/vulnerabilities/:id/resolve
GET    /api/services
GET    /api/services/:id/risk-history
GET    /api/policy-violations
GET    /api/devflow/repos/:id/branches
GET    /api/devflow/repos/:id/commits
POST   /api/devflow/repos/:id/deploy
WS     ws://localhost:4000             ← live events
```

## Phase Roadmap

- **Phase 1 (now)** — Core flow, mock Trivy, dashboard MVP ✅
- **Phase 2** — Real Trivy CLI, TruffleHog, DevFlow Git UI
- **Phase 3** — Snyk, Clerk auth, AWS EC2, Slack alerts, demo video
