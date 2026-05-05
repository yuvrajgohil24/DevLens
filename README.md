# 🛡️ DevLens — Unified Developer Platform

> **Build with Confidence. Deploy with Security. Monitor in Real-time.**

DevLens is a comprehensive dashboard designed to unify code movements, security postures, and deployment pipelines into a single, beautiful interface.

---

## 📖 Essential Documentation

Neeche diye gaye link par click karke project ki detailed working samajhein:
👉 **[PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md)** (What, Why, and How explained)

---

## 🏗️ System Architecture

```mermaid
graph LR
    A[GitHub Push] --> B[CI/CD Pipeline]
    B --> C[DevLens Webhook]
    C --> D[(PostgreSQL)]
    C --> E[Redis Queue]
    E --> F[Scanner Worker]
    F --> G[Trivy / TruffleHog]
    G --> D
    D --> H[Socket.io]
    H --> I[Live Dashboard]
```

## 🚀 Quick Start

### Prerequisites
- **Node.js 20+**
- **npm 10+**
- **PostgreSQL 16** — `winget install -e --id PostgreSQL.PostgreSQL.16`
- **Redis (Windows)** — `winget install -e --id Redis.Redis`

> **Note:** Docker-based setup is planned for a future release to enable one-command startup and easier cross-platform portability.

### 1. Zero to Hero Setup
```bash
# 1. Install PostgreSQL 16 (wizard will open — set password to: devlens)
winget install -e --id PostgreSQL.PostgreSQL.16

# 2. Install Redis for Windows (installs as Windows Service on port 6379)
winget install -e --id Redis.Redis

# 3. Create the devlens DB user (run in psql as postgres superuser)
# CREATE USER devlens WITH PASSWORD 'devlens';
# CREATE DATABASE devlens OWNER devlens;
# GRANT ALL PRIVILEGES ON DATABASE devlens TO devlens;

# 4. Install dependencies + push schema + seed
npm run setup
```

### 2. Launching the Platform
```bash
# Terminal 1 — Backend (Port 4000)
cd apps/backend && npm run dev

# Terminal 2 — Frontend (Port 3000)
cd apps/frontend && npm run dev
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15, TailwindCSS, Socket.io-client, Recharts |
| **Backend** | Express 5, TypeScript, Socket.io, BullMQ |
| **Data** | Prisma ORM, PostgreSQL 16, Redis 7 |
| **Security** | Aqua Security Trivy, TruffleHog |

---

## 📡 API Hub

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/webhooks/pipeline` | Entry point for deployments |
| `GET` | `/api/dashboard/overview` | Platform health & stats |
| `GET` | `/api/vulnerabilities` | Security scan results |
| `GET` | `/api/devflow/repos` | Connected repositories |

---

## 🗺️ Roadmap

- [x] **Phase 1**: Core Live Dashboard & Mock Pipelines
- [x] **Phase 2**: Real-time Trivy & TruffleHog Integration
- [ ] **Phase 3**: Slack/Email Alerts & Managed Cloud Deployment
