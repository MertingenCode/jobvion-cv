# Jobvion

Phase 1 covers the localized site shell, appearance preferences, email and Google sign-in, and the initial credit ledger.

## Run locally

Use Node.js 24 and npm.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open http://localhost:3000. The public shell supports all eight languages without external services. To exercise sign-in, run a local Supabase stack with Docker and the Supabase CLI:

```powershell
supabase start
supabase status
```

Set the public Supabase URL and publishable key in `.env.local` from the local stack. Apply the migration and seed with `supabase db reset` **only against a disposable local stack**, then restart Next.js. Find confirmation messages in the local Mailpit inbox shown by `supabase status`.

For Google OAuth, enable the Google provider and set the two Google environment values referenced by `supabase/config.toml`. In a hosted Supabase project, set the site URL, allow the callback URL for each locale, install `supabase/templates/confirmation.html` as the confirmation template, and configure the Google client and its Supabase callback. Use a nonproduction project and synthetic accounts for validation.

A nonlocal deployment requires an HTTPS `APP_ORIGIN`, configured Supabase and Upstash, and a request header that the trusted ingress overwrites with the client IP. Set `SENTRY_DSN` to enable server monitoring. The server sends generic errors without request details, cookies, bodies or personal fields.

## Verify

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run test:e2e
```

Playwright uses installed Google Chrome by default. To use its managed Chromium, run `npx playwright install chromium`, then set `$env:JOBVION_BROWSER = 'bundled'`.

The credit tests use multiple independent PostgreSQL connections and write synthetic rows. Point them at a migrated, disposable local Supabase database:

```powershell
$env:JOBVION_TEST_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
npm run test:db
```

The database tests cover row isolation, concurrent spending, idempotency, reversal, monthly renewal and partial refunds. The initial credit schema was written from the attached specification. Free credits reset at the beginning of each UTC calendar month. Partial refunds compute the cumulative proportional entitlement and deduct only the unspent balance of the refunded pack. Package seeds have no Paddle price IDs until sandbox prices are configured.

The CV on the public pages is a localized sample. The profile editor, template engine and PDF export start in Phase 2.
