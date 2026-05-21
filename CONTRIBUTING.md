# Contributing to DevLens

Thank you for your interest in contributing to DevLens! We welcome contributions from the community. DevLens is a unified developer platform that covers the complete software delivery lifecycle: Code → Deploy → Monitor → Secure.

## 🚀 Quick Start (Local Setup)

To get DevLens running locally on your machine, follow these steps:

### Prerequisites
- **Node.js** (v20 or higher)
- **npm** (v10 or higher)
- **Docker** and **Docker Compose** (for running PostgreSQL and Redis locally)
- A GitHub account and Personal Access Token (for the DevFlow UI)

### 1. Clone and Install
```bash
git clone https://github.com/yuvrajgohil24/DevLens.git
cd DevLens
npm run setup
```
*(The `npm run setup` script installs dependencies across the monorepo, pushes the Prisma schema, and seeds initial data).*

### 2. Environment Variables
Copy `.env.example` to `.env` in the root of the backend directory (`apps/backend/.env`) and frontend directory (`apps/frontend/.env.local` if using Next.js).
Fill in the required values:
- `DATABASE_URL`: Your PostgreSQL connection string.
- `REDIS_URL`: Your Redis connection string.
- `GITHUB_TOKEN`: Required for DevFlow features to fetch repositories.
- *(Optional)* `SNYK_TOKEN`, `SLACK_WEBHOOK_URL` for full security and notification features.

### 3. Start Local Infrastructure
We provide a `docker-compose.yml` to easily spin up the required databases:
```bash
docker-compose up -d
```

### 4. Run the Development Servers
From the root directory, you can run the backend and frontend concurrently (or run them from their respective folders):
```bash
# In one terminal, start the backend API and Scan Worker:
cd apps/backend
npm run dev

# In another terminal, start the frontend Next.js app:
cd apps/frontend
npm run dev
```

## 🏗️ Architecture Overview

DevLens is structured as a monorepo containing:
- **`apps/frontend`**: A Next.js 15 (App Router) application providing a premium glassmorphism UI.
- **`apps/backend`**: An Express + TypeScript API handling webhooks, deployments, and WebSocket updates.
- **`apps/backend/src/jobs`**: A BullMQ-powered background worker for running asynchronous security scans (Trivy, TruffleHog, Snyk).

## 💡 How to Contribute

1. **Fork the Repository**: Create your own fork of the DevLens repository.
2. **Create a Branch**: Make a new branch for your feature or bug fix (`git checkout -b feature/amazing-feature`).
3. **Write Tests**: If you are adding a new feature or fixing a bug, please add unit tests. We use Jest. You can run tests via `npm test` in the `apps/backend` folder.
4. **Follow Typing Guidelines**: Ensure your TypeScript code has proper types and avoids `any`.
5. **Commit Changes**: Write clear, descriptive commit messages.
6. **Submit a Pull Request**: Push your branch to your fork and submit a PR against our `main` branch.

## 🐛 Found a Bug?
If you find a bug, please open an issue in the GitHub issue tracker with a clear title and description, steps to reproduce, and any relevant logs.

---
*By contributing to DevLens, you agree that your contributions will be licensed under its open source license.*
