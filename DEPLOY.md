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
# In the Backend service (the GitHub service Railway created):
# 1. Go to "Settings" tab
# 2. Set "Root Directory" → apps/backend
# 3. Set "Build Command" → (leave empty — Dockerfile handles it)
# 4. Set "Watch Paths" → apps/backend/**
# Railway will auto-detect the Dockerfile

# ── STEP 5: Set Backend Environment Variables ─────────────────────────────────
# In Backend service → "Variables" tab, add ALL of these:

DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
PORT=4000
NODE_ENV=production
FRONTEND_URL=https://your-vercel-app.vercel.app

GITHUB_TOKEN=your_github_pat_token
GITHUB_OWNER=yuvrajgohil24
GITHUB_REPO=DevLens

SLACK_WEBHOOK_URL=your_slack_webhook_url
SNYK_TOKEN=your_snyk_token

CLERK_SECRET_KEY=your_clerk_secret_key
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key

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
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_d2l0dHktbW91c2UtMjUuY2xlcmsuYWNjb3VudHMuZGV2JA
CLERK_SECRET_KEY=sk_test_fJNZWfsXPeHew1fVkOc5aBApQqYTNSqT8ff61ycBIk
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
