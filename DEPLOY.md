# ── Railway Deployment Guide — DevLens ───────────────────────────────────────
# DevLens Deploy Architecture:
#   Railway → PostgreSQL plugin (managed DB)
#   Railway → Redis plugin (managed Redis)
#   Railway → Backend service (Dockerfile)
#   Vercel  → Frontend service (Next.js — free)

# ── STEP 0: Push latest code to GitHub ───────────────────────────────────────
# Make sure all your recent changes are on GitHub before starting Railway setup

# ── STEP 1: Create Railway Project ───────────────────────────────────────────
# 1. Go to https://railway.app → Login with GitHub
# 2. Click "New Project"
# 3. Select "Deploy from GitHub repo"
# 4. Select: yuvrajgohil24/DevLens
# 5. Click "Add variables" — we'll do this later

# ── STEP 2: Add PostgreSQL Plugin ────────────────────────────────────────────
# In your Railway project dashboard:
# 1. Click "+ New" → "Database" → "Add PostgreSQL"
# 2. Railway will auto-create DATABASE_URL — copy it

# ── STEP 3: Add Redis Plugin ─────────────────────────────────────────────────
# 1. Click "+ New" → "Database" → "Add Redis"
# 2. Railway will auto-create REDIS_URL — copy it

# ── STEP 4: Configure Backend Service ────────────────────────────────────────
# In the Backend service (the GitHub service Railway created) → "Settings":
# 1. Root Directory      → (leave EMPTY — the Docker build needs the repo-root lockfile)
# 2. Config file path    → /apps/backend/railway.json
#    (sets Dockerfile = apps/backend/Dockerfile, healthcheck /health, watch paths)
# 3. Build/Start Command → leave empty (the image runs migrations, then the API)
#
# On first deploy the start script baselines a database created by the old
# `prisma db push` start command, then applies pending migrations. No data loss.

# ── STEP 4b (optional): Separate scan worker ─────────────────────────────────
# Long scans (git clone + Trivy + TruffleHog) can run in their own service so
# they never slow down the API:
# 1. "+ New" → "GitHub Repo" → same repo → name it "devlens-worker"
# 2. Settings → Root Directory: (empty) · Config file path: /apps/backend/railway.worker.json
# 3. Variables: same as the backend (Step 5) — no public domain needed
# 4. On the API service add: RUN_SCAN_WORKER=false

# ── STEP 5: Set Backend Environment Variables ─────────────────────────────────
# In Backend service → "Variables" tab, add ALL of these:

DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}?family=0   # family=0: Railway private network is IPv6
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app

GITHUB_TOKEN=your_github_pat_token
GITHUB_OWNER=yuvrajgohil24

SLACK_WEBHOOK_URL=your_slack_webhook_url
SNYK_TOKEN=your_snyk_token

CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
DEMO_USER_ID=user_xxx

# HMAC secret for /api/webhooks/pipeline (same value as GitHub secret DEVLENS_WEBHOOK_SECRET)
WEBHOOK_SECRET=output_of_openssl_rand_hex_32

# Access control: comma-separated Clerk user ids allowed to perform write actions
ADMIN_USER_IDS=user_your_own_clerk_id

# Do NOT set in production: LOCAL_GIT_ACTIONS (server-side git push/pull) or MOCK_SCANNERS=true

# Secret scanning: DevLens' own history (commits a72814e, 441b4ff) contains dummy
# test secrets. Start TruffleHog after them so DevLens deploys aren't blocked by them:
TRUFFLEHOG_SINCE_COMMIT=bc254379203594b3f044f83d25d7d1692b135d05

# Optional tuning
# RUN_SCAN_WORKER=false        # only when a separate worker service runs (Step 4b)
# SCAN_CONCURRENCY=2           # parallel scans per worker
# SCANNER_TIMEOUT_MS=600000    # max time per scanner run

# ── STEP 6: Deploy Backend ────────────────────────────────────────────────────
# Click "Deploy" in Railway
# Wait ~3-5 mins for build (Trivy + TruffleHog install takes time)
# Check logs — should see:
#   ✅ PostgreSQL connected
#   🚀 DevLens Backend running at http://...

# After deploy, copy the Railway backend URL (e.g. https://devlens-backend.up.railway.app)

# ── STEP 7: Deploy Frontend on Vercel ────────────────────────────────────────
# 1. Go to https://vercel.com → Login with GitHub
# 2. Click "New Project" → Import: yuvrajgohil24/DevLens
# 3. Set "Root Directory" → apps/frontend
# 4. Framework: Next.js (auto-detected)
# 5. Add Environment Variables:
NEXT_PUBLIC_API_URL=https://<your-railway-backend-url>
NEXT_PUBLIC_WS_URL=https://<your-railway-backend-url>
NEXT_PUBLIC_ALLOW_SIGN_UP=false   # invite-only; also enable Restricted mode in Clerk dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_your_publishable_key
CLERK_SECRET_KEY=sk_test_your_clerk_secret_key   # never commit real keys
# 6. Click "Deploy"

# ── STEP 8: Update FRONTEND_URL in Railway Backend ───────────────────────────
# After Vercel deploy, go back to Railway Backend → Variables
# Update: FRONTEND_URL=https://<your-vercel-url>
# This is needed for CORS to work correctly

# ── STEP 9: Update GitHub Actions Webhook URL ─────────────────────────────────
# Go to: GitHub → DevLens repo → Settings → Secrets and variables → Actions
# Update secret: DEVLENS_WEBHOOK_URL = https://<your-railway-backend-url>

# ── STEP 10: Verify Everything Works ─────────────────────────────────────────
# 1. Open Vercel frontend URL → Dashboard should load
# 2. Push a commit to DevLens repo → GitHub Actions should fire → Dashboard updates
# 3. Check Slack → should receive scan alert
