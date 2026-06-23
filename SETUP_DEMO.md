# Public Demo / Guest Mode

DevLens ships with a **"Continue as Guest"** button on the sign-in and sign-up pages.
It signs visitors into a shared, **read-only** demo account and drops them on the
dashboard pre-loaded with realistic seeded data — so recruiters can explore the product
without creating an account or hitting a login wall.

## How it works

```
"Continue as Guest" → POST /api/demo/session (backend mints a Clerk sign-in token)
                    → signIn.create({ strategy: 'ticket', ticket }) → /dashboard (seeded data)
```

- **Backend:** `POST /api/demo/session` (`apps/backend/src/api/demo.ts`, public) uses the Clerk
  secret key to mint a short-lived **sign-in token** for the demo user. Tokens create a complete
  session and **bypass password + MFA**, so no demo password is ever shipped to the browser.
- **Frontend:** custom Clerk pages at `/sign-in` and `/sign-up` (`app/(auth)/...`) with a
  `GuestButton` that fetches the token and consumes it via `signIn.create({ strategy: 'ticket' })`.
- **Read-only on the client:** `useDemoMode()` (`lib/demo.ts`) detects the demo session (by email
  or `publicMetadata.role === 'demo'`) and shows a banner + disables the "Resolve" buttons.
- **Read-only on the server:** `blockDemoWrites` (`apps/backend/src/middleware/demoGuard.ts`)
  rejects any `POST/PUT/PATCH/DELETE` from the demo user with `403`.

## One-time setup (2 steps)

### 1. Create the demo user in Clerk

In the [Clerk dashboard](https://dashboard.clerk.com) → **Users → Create user**:

- Email: `demo@devlens.app` (or your own — set it as `NEXT_PUBLIC_DEMO_EMAIL` for the banner)
- (Optional, recommended) under **Metadata → Public metadata** add: `{ "role": "demo" }`
- Copy the new user's **User ID** (`user_…`) into `DEMO_USER_ID`

> No password or MFA setup is required — the ticket flow doesn't use them. The account just
> needs to exist. (If the user happens to have MFA enrolled, the ticket still bypasses it.)

### 2. Fill env vars and seed the database

In your `.env` (see `.env.example`):

```bash
# Backend — needed to mint the sign-in token + enforce read-only
CLERK_SECRET_KEY=sk_test_xxx
DEMO_USER_ID=user_xxxxxxxxxxxxxxxx

# Frontend
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_DEMO_EMAIL=demo@devlens.app   # for the "Demo mode" banner
NEXT_PUBLIC_API_URL=http://localhost:4000 # where the guest button posts
```

Seed realistic sample data (services, deployments, CVEs, policy violations).
**Run these from `apps/backend`** (that's where the Prisma schema lives) with Postgres
+ Redis running (`docker-compose up -d` from the repo root if they aren't):

```bash
cd apps/backend
npm run db:generate   # prisma generate (first run only)
npm run db:push       # create tables on a fresh DB (first run only)
npm run db:seed       # populate sample data  (== npx prisma db seed)
```

## Verify

1. Make sure the **backend is running** (the guest button calls it to mint the token).
2. Open `/sign-in` → click **Continue as Guest**.
3. You should land on `/dashboard` with the amber **"Demo mode"** banner and seeded data.
4. On **Vulnerabilities** / **Policy Violations**, the **Resolve** buttons are disabled.
5. Sign out via the avatar (top-right `UserButton`) → returns to `/sign-in`.

## Notes

- **No demo password in the browser** — auth is via a backend-minted sign-in token, which also
  sidesteps any MFA enrolled on the demo user. Keep the account read-only anyway; the backend
  guard (`demoGuard`) enforces it even if the client is bypassed.
- The token endpoint is public but only ever mints a token for the single `DEMO_USER_ID`.
- To rotate the demo, just recreate the user and update `DEMO_USER_ID`.
