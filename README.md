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

## Admin and blog

Apply the migrations to your Supabase project. In a disposable local stack, the seed loads five English drafts. For an existing database, run `supabase/blog-drafts.sql` with a privileged connection to add the same drafts without replacing edits. Review the articles before publishing.

Sign up and confirm the first owner account. Copy its user UUID from Supabase Authentication, set the server-only service key in `.env.local`, and run:

```powershell
npm run admin:bootstrap -- --user <confirmed-auth-user-uuid> --confirm
```

Sign in, open `/tr/admin` (or `/en/admin`), and use a TOTP authenticator. Keep Supabase MFA enrollment and verification enabled. The owner assigns the other roles from **Roles**. Editors write and send posts for review. Owners and administrators publish, schedule, unpublish, archive and restore. Review precedes publication. A public article must be published, including its sitemap entry and language alternates.

Schedule an authenticated `POST /api/internal/publish-blog` every minute on your hosting scheduler. Send `Authorization: Bearer <BLOG_CRON_SECRET>` from the scheduler secret store. The app uses `SUPABASE_SERVICE_ROLE_KEY` to run the worker. Until the scheduler is connected, **Publish** works manually and future-dated posts remain scheduled. Scheduled dates are entered in UTC.

Admin reports use data already recorded in accounts, the credit ledger, purchases, generation runs and LLM call logs. The date filters use rolling UTC periods. Finance groups currencies and reports refunds against the original order period. Provider cost comes from recorded USD call costs. Promotional-credit adjustments require a separate ledger design and expiration policy.

Run `npm run test:db` against a disposable migrated database to verify role enforcement, MFA gating, revision conflicts, draft privacy and scheduled publishing. Run `npm run test:e2e` to verify the public routes, access denial and sitemap.

## CV workspace

Apply the CV migration with the existing Supabase migrations, sign in and open `/tr/app/cv` or `/en/app/cv`. The editor autosaves the structured profile. Saving a CV creates a separate snapshot of the text and document settings. The selected CV language is independent of the application language.

The catalog contains 30 templates. Accounts without a server-backed template entitlement can preview the catalog and save or export Essential, Compact and Executive. Premium entitlement is backed by `cv_template_entitlements` and is independent of generation credits. This phase does not connect an entitlement sale or a subscription.

Photo-enabled templates can use the current profile photo. Uploads accept JPEG, PNG or WebP up to 4 MB and use `SUPABASE_SERVICE_ROLE_KEY` on the server to write the normalized JPEG. The original upload is discarded. Changing or removing the profile photo affects future exports from saved documents that had the photo enabled. Public URLs are never assigned to photos.

### PDF renderer

Run the renderer as a separate private service with the same `PDF_RENDERER_TOKEN` configured on the app and the worker. Set `PDF_RENDERER_URL` in the app to the worker origin, such as `http://127.0.0.1:4025` locally. The token needs at least 32 characters.

For local development, use installed Chrome by setting `$env:PDF_CHROMIUM_CHANNEL = 'chrome'`, then run `npm run pdf:dev`. For the production image:

```powershell
docker build -f services/pdf-renderer/Dockerfile -t jobvion-pdf .
```

Deploy the image to a private network reachable only from the application. Keep Chromium sandboxing enabled, give the container a writable temporary directory, and use a host seccomp policy that permits Chromium's user namespaces if the default blocks them. Limit container CPU and memory. The renderer blocks external network requests per browser context and reads fonts and portraits from in-memory data URLs.

To verify real text order with running Chrome, install or use a Python environment containing `pypdf`. Set `JOBVION_PDF_TEST_PYTHON` to its executable alongside the renderer URL and token, then run `npm run test:pdf`. The test exports multi-page Turkish and German ATS documents, checks page sizes and heading order, and compares a premium layout with and without a photo.

## Application, payments and production setup

1. Apply all Supabase migrations. Start the private PDF renderer and configure the shared renderer token before enabling PDF download or ZIP data export.
2. Set an OpenAI-compatible HTTPS base URL, API key, model and current input/output USD token rates. The cap is measured in microdollars. For example, 1000000 represents USD 1. Each provider attempt reserves a conservative amount until the next UTC day. Alert on budget warnings in the deployment logs.
3. In Cloudflare, create a Turnstile widget for the application host. Set its public site key in Jobvion. In Supabase Auth Bot and Abuse Protection, enable Turnstile with the matching secret. This enables checks on signup and email/password login.
4. In Paddle, configure the approved HTTPS checkout domain and an HTTPS default payment URL ending in /en/checkout. Create the 15, 40 and 100 credit prices at USD 4.99, 9.99 and 19.99. Load their IDs and run the command below. A credit package adds application credits. Premium template entitlement is managed separately.
5. In Paddle, configure the notification destination /api/billing/webhook with transaction.completed, adjustment.created and adjustment.updated. Copy that destination’s signing secret to the environment. Verify buyer receipts and refund notices using the configured seller account.
6. Schedule authenticated POST requests to /api/internal/maintenance using the maintenance bearer secret, and to /api/internal/publish-blog using the blog bearer secret. Maintenance reverses abandoned first-use application runs, clears expired Paddle event payloads and processes due account deletions. CV photos and blog covers are stored inline in PostgreSQL, so there is no separate object-storage cleanup job.
7. Authorized owner/admin users can grant promotions from the admin dashboard. Credits expire after 30 days. Unspent promotional credits can be revoked with a reason. Application packs use monthly free credits first, followed by valid promotional credits and paid credits.
8. Admin reports refresh from PostgreSQL on request. Registered accounts are counted across all time. Other counts use the selected rolling period in UTC. Active accounts have at least one generation run in that period. Gross credit spends include promotional use and reversals are tracked separately. Finance groups Paddle orders by original currency. AI costs use the configured provider rates and recorded token usage.
9. Review SECURITY_CHECKLIST.md and RELEASE_CHECKLIST.md before deployment. The English and Turkish legal pages are review drafts.

```powershell
npm run paddle:configure -- --confirm
```
