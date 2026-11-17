# JOBVION — GLOBAL PROJECT SPECIFICATION & BUILD PROMPTS

> Single source file combining the original `CLAUDE.md` and `build_prompts.md`, updated for global launch. Save as `CLAUDE.md` at repository root. Do not maintain a second competing instructions file. Phase prompts are included at the end of this file.
> This is an engineering specification, **not legal advice**. All legal drafts require qualified jurisdiction-specific review.

---

# Jobvion — AI CV Tailoring & ATS-Friendly Resume Builder

> Put this file in the repo root (CLAUDE.md for Claude Code, AGENTS.md for Codex/Cursor).
> The product and brand name is **Jobvion** (exact capitalization). Use **Jobvion** consistently in UI, SEO metadata, emails, legal draft placeholders, payment descriptions, and documentation. Use `jobvion` for code identifiers and package names where appropriate. Do not invent a domain, company legal entity, or trademark status. Read this file fully before every task.

## 1. Product

**Brand:** Jobvion. Product naming must remain consistent across all supported locales; translate descriptive copy, not the brand name.

A web app for job seekers (global from day one, with localized experiences and jurisdiction-aware compliance) that:
1. Builds a CV from scratch (profile form, many templates).
2. Tailors an existing CV/profile to a specific job posting (match report, then tailored CV + cover letter).
3. Converts an existing CV into an ATS-friendly one (later milestone).
4. Generates cover letters.

Everything runs on ONE engine: a structured **profile JSON** (single source of truth) + a **job analysis JSON** → generation layer → template layer → PDF.

### v1 (MVP) scope — build ONLY this
- Auth (email + Google), profile form, 3 ATS-safe templates, PDF export.
- Job input by **pasted text only**. Job analysis → match report → tailored CV + cover letter.
- Credit system + Paddle checkout (one-time credit packs) + refund webhook.
- Legal pages, account deletion, data export, consent log.
- UI languages at launch: EN, TR, DE, FR, ES, IT, PT, NL (translation dictionaries reviewed by native speakers where feasible). CV output languages: TR, EN, DE, FR, ES, IT, PT, NL. UI language and CV language are independent. Add new locales only with complete translated UI, tests and SEO metadata.
- Light + dark theme with system preference as the default. SEO-ready marketing pages across supported locales.
- Protected admin console with operational/financial/AI analytics, audit logging and minimum-necessary user support controls.
- Public editorial blog with multilingual-ready content model, admin CMS, SEO and publication workflow. Start with quality English posts; translate only when reviewed.

### Out of scope for v1 (do NOT build unless asked)
Subscriptions, screenshot-based job input, job URL fetching, ATS converter for uploaded CVs, DOCX export, application tracker, LinkedIn import, extra UI languages, browser extension.

## 2. Tech stack

- Next.js (App Router) + TypeScript (strict) + Tailwind + shadcn/ui. Use the latest **patched** stable version; check current Next.js security advisories before pinning. Never use 13.x/14.x.
- i18n: next-intl, locale in URL (`/en`, `/tr`, `/de`, `/fr`, `/es`, `/it`, `/pt`, `/nl`). On the root entry route only, resolve language in this order: explicit user selection (cookie/account preference) > browser Accept-Language / navigator.languages matching supported locales > EN fallback. Never infer language from IP. Preserve explicit locale URLs; never redirect crawlers away from localized URLs. Provide a visible language selector on all pages. Set locale cookie with appropriate SameSite/Secure flags and sync account preference after login. Avoid hydration mismatch and redirect loops. Language detection is NOT country/legal-jurisdiction detection.
- Supabase: Postgres, Auth, Storage. **EU region (Frankfurt) initially; document all subprocessors, access locations, onward transfers and actual residency limitations; do not claim universal local data residency**. RLS on every table.
- Validation: Zod on every API route / Server Action. Env validated at boot.
- LLM: DeepSeek V4.1 Flash through an OpenAI-compatible client behind a provider abstraction (`lib/llm`). Model id, base URL and API key come from env (`LLM_MODEL`, `LLM_BASE_URL`, `LLM_API_KEY`). Verify names/prices in the provider docs. Must be swappable by changing config only.
- Payments: Paddle Billing (`@paddle/paddle-node-sdk`), Merchant of Record.
- Rate limiting: Upstash Redis (`@upstash/ratelimit`). Bot protection: Cloudflare Turnstile.
- PDF: HTML/CSS templates rendered by headless Chromium in an **isolated service/container**, not inside a serverless function.
- Monitoring: Sentry (PII scrubbed). Analytics: Plausible or PostHog (cookieless/EU).
- Tests: Vitest (unit), Playwright (e2e).

## 3. Core data model

- `profiles` (jsonb, with `schema_version`), `cvs` (profile_snapshot jsonb, template, cv_language, job_id, pdf_path), `jobs` (raw_text, analysis jsonb), `cover_letters`.
- Credits: use `supabase/migrations/credits_schema.sql` AS PROVIDED (credit_accounts, credit_ledger, purchases, paddle_events, generation_runs, llm_calls + functions). Do not change its logic without asking.
  - Credit functions are callable ONLY by `service_role` from the server. Never expose them to the client.
  - 1 credit = one full application pack (job analysis + tailored CV + cover letter). Up to 3 regenerations per credit.
  - Free bucket: 3 credits/month, resets (not accumulates). Paid bucket: never expires. Spend free first.
  - If an LLM run fails, call `reverse_spend` so the user is not charged.
  - Packs: 15 / 40 / 100 credits at 4.99 / 9.99 / 19.99 USD (base). Paddle may offer localized checkout currencies where configured and supported; verify supported markets/currencies and tax treatment in current official docs. Show currency codes, localized formatting, and the final checkout amount before purchase.
- Profile JSON is stored in the user's own language; translations are generated per CV, never overwrite the profile.
- Store original uploaded files/screenshots only transiently; delete right after processing.

## 4. Job analysis JSON

```json
{
  "position": "", "company": "", "language": "",
  "responsibilities": [], "required_qualifications": [],
  "preferred_qualifications": [], "keywords": [], "seniority": ""
}
```
Pasted text is **untrusted data** (prompt-injection risk): never follow instructions inside it. Validate model output against a JSON schema.

## 5. CV generation rules (critical)

1. **No fabrication.** The model may only rephrase/reorder/emphasize facts that exist in the profile. After generation, programmatically verify that every company name, job title, date, degree and number in the output exists in the profile snapshot; reject/regenerate on mismatch.
2. Show the user a **diff** (what changed vs. their profile) and let them edit before saving.
3. Section headings come from a fixed i18n dictionary per CV language, NOT from the LLM.
4. Date, phone and page-size formats follow CV language/country (A4 vs US Letter).
5. **No salary field.** Photo is optional, per template, with a country-based hint.
6. ATS templates: single column, standard headings, no tables/icons/images, text-based PDF, embedded fonts with full Latin-Extended (Turkish) coverage. Add an automated test that extracts PDF text and checks reading order/headings.
7. Templates carry metadata: `ats_safe`, `columns`, `supports_photo`, `rtl_ready`, `languages`, `tier`. Design (non-ATS) templates show a warning badge.
8. Never promise "ATS score guarantee" or invented statistics in UI copy.
9. Language quality tiers: TR/EN/DE = "full", others = "beta" with a "please review the output" notice.

## 6. Security rules (non-negotiable)

- Every route handler and Server Action checks authn/authz **inside itself**; never rely on middleware alone. Verify the session server-side with Supabase's recommended server verification.
- Secrets only in server env. Never in `NEXT_PUBLIC_*`. `service_role` and LLM/Paddle keys never reach the browser or logs. Provide `.env.example`, never commit `.env`.
- Zod validation with max lengths (job text, fields), reject unknown fields. File uploads: type + magic bytes + size limits.
- Rate limit per IP and per user on signup, login, generation, upload. Add a **global daily LLM spend cap** (kill switch) with alerting.
- Paddle webhook: verify signature on the **raw body**, dedupe by `event_id` via `paddle_events`, idempotent handlers. Determine the package from the Paddle `price_id` on the server. Create transactions server-side; never trust client-sent user ids or prices.
- Security headers: CSP (nonce), HSTS, X-Content-Type-Options, Referrer-Policy, frame-ancestors, Permissions-Policy. CORS locked to own origin. Cookies Secure/HttpOnly/SameSite.
- LLM/HTML safety: escape all LLM/user text when rendering HTML (XSS). LLM gets no tools and no secrets.
- PDF renderer is locked down: JavaScript disabled, all network requests blocked except data: URIs and bundled fonts, no `file://`, runs as low-privilege user in an isolated container.
- (Later) URL fetching must be SSRF-safe: http/https only, block private/loopback/link-local/metadata IPs after DNS resolution and on every redirect, timeouts, max size.
- Do not allow untrusted SVG uploads or SVG image optimization.
- Pin exact dependency versions, enable Dependabot/Renovate, run `npm audit` in CI. Do not use experimental Next.js features unless asked.
- Errors shown to users never leak internals. Logs never contain CV content, tokens or personal data.
- Write a test that proves user A cannot read user B's rows (RLS) and that concurrent credit spends never overdraw.

## 7. Privacy / global data protection rules

- Data minimization. Before sending content to the LLM, replace name/phone/email/address with placeholders and re-insert locally after generation. Send only what the task needs.
- Cross-border transfers may be regulated by GDPR/UK GDPR and KVKK art. 9, depending on applicability: do not use blanket explicit-consent checkboxes as a substitute for valid transfer mechanisms (such as appropriate safeguards/adequacy where available). Do NOT add a "consent to transfer" checkbox as the legal basis. Keep a `config/processors.ts` list (service, purpose, data categories, region) so the privacy notice and the lawyer's data-flow map stay accurate. Any NEW third-party service that receives personal data requires asking me first.
- Account deletion: confirm identity, cancel active payments, 7–30 day grace period, then hard-delete profile/CVs/jobs/files and LLM-related records. `purchases` rows are anonymized (user_id null) and retained for legal reasons.
- Data export: "Download all my data" (JSON + PDFs).
- Record Terms acceptance with version and timestamp. Record privacy notice delivery/version separately (notice is not automatically consent); record consent only for activities that actually rely on consent. Allow withdrawal of optional consent.
- Required localized pages for supported locales: Privacy Notice, Terms of Use, Refund Policy, and a Cookie Notice/controls where applicable. Add region-specific supplements (e.g., KVKK Aydınlatma Metni for applicable Turkish processing and GDPR rights/transparency for EEA/UK processing). Do not assume a universal policy or automatic exemption based on incorporation country. Do not assert that consent is always required for processing; use legally appropriate bases and notices. If non-essential analytics/cookies or marketing technologies are used, gate them by applicable regional rules and record choices. Determine applicability with counsel based on establishment, targeting, data subjects, processors, and transfers. Generate **drafts clearly marked `TODO(legal-review)`**; never present them as final legal text.
- Minimum age: 18+ (state in terms; assess local requirements with counsel). Marketing emails require a separately managed opt-in where legally required, plus unsubscribe and suppression handling.

## 8. Payments & refunds

- Paddle is the seller (Merchant of Record). Refunds are decided/processed by Paddle; our job is to react to webhooks.
- On full/partial refund webhook: call `apply_refund`, deduct remaining credits from the purchased pack, flag accounts with repeated refunds, email the user.
- Cancellation/refund links in account settings; refund policy page linked at checkout and in the footer.
- No subscription logic in v1, but keep tables extensible (a future third credit bucket and a `subscriptions` table).

## 9. SEO rules

- Marketing pages (home, pricing, template gallery, guides, example CVs, cover letter examples) are static/ISR Server Components with unique title/description/canonical via `generateMetadata`, one `h1`, semantic headings.
- `app/sitemap.ts`, `app/robots.ts`; app area (`/app`, `/dashboard`, `/api`, checkout) is `noindex` and excluded.
- Per-locale URLs for EN/TR/DE/FR/ES/IT/PT/NL, `alternates.languages` hreflang + x-default, `<html lang>` correct, locale-aware canonical, localized sitemap entries. Do not publish empty/machine-drafted thin pages.
- JSON-LD: Organization, WebSite, SoftwareApplication, BreadcrumbList, Article (escape `<` in JSON-LD).
- `next/font` (subsets latin + latin-ext), `next/image`, minimal client JS, no layout shift. Target good Core Web Vitals.
- No thin/auto-generated bulk pages. Content must be genuinely useful; mark placeholders `TODO(content)`.

## 10. Design rules

- Use the **Hallmark** design skill. Create `tokens.css`/`design.md` FIRST with the palette below so the skill follows it. Run `hallmark audit` on each finished screen.
- Tone: calm, trustworthy, professional. No neon gradients, no fake stats, no fake testimonials, no invented user counts.
- System theme default + light/dark themes: follow `prefers-color-scheme` automatically, including live OS changes, until the user explicitly selects Light or Dark. Manual toggle (Light/Dark/System), persisted preference, no flash on load (SSR-safe initial script or equivalent), no hydration mismatch. The **CV preview is always a white paper**, independent of theme.
- Mobile-first (320/375/414/768). Editor = form on the left, live preview on the right (stacked on mobile).
- Fonts: Inter (latin + latin-ext) for UI. CV templates use their own fonts (Source Sans / Lato / Noto Sans).
- Accessibility: keyboard navigation, visible focus, AA contrast in BOTH themes.
- ATS badge = green; design-template warning = amber.

| Role | Light | Dark |
|---|---|---|
| Primary | `#2557D6` | `#5B8CFF` |
| Heading/text | `#0F1B3D` | `#E6ECF5` |
| Accent | `#0EA5A4` | `#2DD4BF` |
| Background | `#F8FAFC` | `#0B1220` |
| Surface | `#FFFFFF` | `#111A2E` |
| Border | `#E2E8F0` | `#24324D` |
| Muted text | `#64748B` | `#94A3B8` |
| Success / Warning / Danger | `#16A34A` / `#F59E0B` / `#DC2626` | same, adjusted for contrast |

## 11. Engineering conventions

- TypeScript strict, no `any`. Server-only code marked with `server-only`. Feature-based folders. Small, reviewable commits (conventional commits).
- Migrations live in `supabase/migrations`. Never edit the DB by hand.
- Every new endpoint: Zod schema, auth check, rate limit, test.
- Unit-test credit logic, fact-check verifier, webhook handler, prompt-output schema validation. E2E: signup → profile → tailor → download.
- All user-facing strings, validation errors, transactional email templates, accessibility labels, legal navigation and SEO copy go through versioned locale files (EN/TR/DE/FR/ES/IT/PT/NL). No hardcoded strings. Use Intl for dates, numbers, pluralization and currency display; store UTC timestamps and ISO currency codes. Never infer citizenship, address, taxes or legal jurisdiction from UI locale.
- Keep prompts in `lib/prompts/` as versioned files, with the "no fabrication" rule and JSON-only output instructions.
- Log token usage and cost per LLM call into `llm_calls`.

## 12. How to work with me

- Before coding a milestone: show a short plan, list assumptions and open questions, then wait.
- Ask before: changing the credits schema, adding any third-party service that receives personal data, adding dependencies with network access, deleting files, or expanding scope beyond v1.
- After each milestone: summarize what changed, how to run/test it, and what remains. Flag anything you were unsure about, especially security and KVKK items.
- Never invent API names/prices/legal text. If unsure (Paddle events, DeepSeek model id, Supabase APIs), check the official docs or say so.

## 13. Global-first localization, regional UX and compliance (mandatory)

- Supported UI locales: `en`, `tr`, `de`, `fr`, `es`, `it`, `pt`, `nl`; EN is the ultimate fallback. Language negotiation should match primary subtags and sensible regional variants (e.g., `en-US` → `en`, `pt-BR` → `pt`), without assuming region-specific legal eligibility. Preserve `?` query params where safe.
- Language priority: explicit selector/account preference > saved locale cookie > Accept-Language at first request > EN. A user-selected language must never be overridden by browser detection. Provide language switching without losing unsaved form data. On sign-in reconcile anonymous cookie and stored account preference deterministically.
- Locale routing: root `/` can route to localized home; direct `/fr/...` stays French. Bot-safe canonical and `hreflang` (including `x-default`) across fully translated public pages; no automatic IP geolocation redirects.
- Theme priority: explicit user setting `light`/`dark`/`system` (cookie/local preference) > `system` default. In `system`, use OS `prefers-color-scheme`, react to changes immediately. Prevent first-paint flash; keep SSR and hydration consistent. CV document/print preview remains white. Theme is separate from language.
- Internationalization: use ICU messages and Intl formatting, localized email and errors, translated template names, accessible language labels. Dates, decimal separators, names, addresses, phone numbers, postal codes and paper formats must be configurable, not hardcoded to Turkey. Preserve user-provided original facts and spellings; don't silently translate proper nouns.
- CV language and UI language are distinct controls. Default new CV language to UI language only if supported; user can override. Use language-specific CV section dictionaries and country-appropriate conventions. Never guess the target country's hiring law from language.
- Checkout: currency shown should match the final Paddle quote where supported; show currency code and taxes/fees clearly. Never compute payable price from a guessed FX rate. Localized prices are display-only until verified by Paddle.
- Global privacy: maintain a data inventory, processing purposes, lawful bases where relevant, retention schedule, subprocessors, region/access map, transfer mechanism assessments, rights-request workflow, breach-response procedure, and jurisdiction-specific notices. Do not treat the country of incorporation as the only applicability criterion. GDPR/UK GDPR and KVKK may apply simultaneously. Consult qualified counsel before launch, including controller/processor roles, EU/UK representative or DPO where required, SCCs/adequacy, KVKK transfer rules, and consumer/refund requirements.
- Privacy by design: avoid sending full CV data to analytics/error reporting. Ensure user export, deletion and correction flows work regardless of locale. Record actual terms acceptance, not fabricated privacy 'consent'. Avoid non-essential trackers until appropriate regional consent/opt-out implementation exists.
- Deployment: make the product globally accessible, but document countries blocked by payment/provider availability, sanctions or compliance; don't promise universal availability. Test accessibility, font coverage, right-to-left readiness for future languages, time zones, locale routing and translations.
- Never auto-create legal claims, provider pricing, compliance certifications or unsupported translations. Draft legal content as `TODO(legal-review)` and verify official documentation at implementation time.

## 14. Admin console and analytics (required in v1)

- Routes: `/admin` (overview), `/admin/analytics`, `/admin/ai-usage`, `/admin/finance`, `/admin/credits`, `/admin/users`, `/admin/blog`, `/admin/system`, `/admin/audit`. Admin is **not** a public account role or user-editable profile field.
- Authentication AND authorization on every admin page, route, action and database operation. Enforce privileged access server-side using a separate admin membership/role table or verified server-side identity claims; never trust client-side role flags. Default-deny. Support `owner`, `admin`, `support`, `editor`, `analyst` with least-privilege permission matrix. Owner role provisioned via secure out-of-band bootstrap, never public registration. Protect admin login with MFA where supported, rate limits, session revalidation and sensitive-action confirmation.
- `/admin` must not be indexed; exclude from sitemap and public navigation. Hiding the route is not authorization.
- Dashboard KPIs: registered users, new users, active users (define exact event-based 7/30-day metric), CVs generated, tailored CVs, cover letters, completed application packs, credits spent, conversion, paid orders, refunds, provider cost and estimated gross margin. Show date range, timezone (UTC default), comparison period, currency, source and last-updated timestamp. Never invent data or label estimated figures as actual.
- Financial reporting: Paddle-verified gross sales, taxes/fees/refunds where provided, estimated net proceeds and AI infrastructure costs; reconcile via Paddle transaction identifiers and events, avoid double-counting. Explicitly label estimates and pending amounts; do not equate sales to bank deposits or accounting profit. Multi-currency: store ISO currency + original amounts, convert for dashboards only using an identified rate source and date, or group by currency; never sum different currencies without conversion.
- AI analytics: per-provider/model call counts, latency, tokens, actual/estimated cost, failure rate, retries, average cost per generation and per credit, daily cap usage and anomaly alerts. Use existing `llm_calls` and `generation_runs` tables where possible; do not change `credits_schema.sql` logic without approval.
- Credit analytics: free/paid credit issuance, spending, reversals, unused balances and refund-related adjustments. Authorized owner/admin users can grant promotional credits, revoke unspent manually granted credits, and view a searchable credit adjustment history. Require a reason, idempotency key, immutable audit trail, and atomic server-side ledger transactions. Never directly edit balances. Do not introduce a separate test-credit balance, test-credit product, or test-credit issuance feature.
- Admin credit management UI: search/select a user, display current free/paid/promotional balances and ledger history, enter a positive grant or bounded revocation amount, require a written reason and confirmation, and show a transaction receipt. Promotional grants must never be recorded as Paddle purchases or recognized as revenue. Prevent negative balances, duplicate submissions, unauthorized actions and removal of already-spent credits. Define promotional credit expiration policy explicitly before implementing. Keep purchase refunds on their existing dedicated refund path.
- Promotional credits may be granted to authorized accounts without a purchase, subject to documented limits, audit logging, and the global AI spend cap. Do not create separate test credits or unlimited admin balances.
- User management: search by minimum necessary metadata, view account status, signup date, subscription-independent purchase/credit summary, and apply documented support actions. No default access to private CV content, job text or cover letters. Support role must not see full personal documents unless a separately authorized, logged support workflow is designed and approved.
- Blog CMS permissions: editor can draft/edit; publisher/admin can publish, unpublish and schedule. Audit every publishing action and important admin mutation (actor, action, target id, timestamp, sanitized metadata, outcome); never log CV bodies, secrets or unnecessary personal data.
- Analytics collection: privacy-minimized aggregate event counters or cookieless analytics; do not add tracking vendors or cookies without approval and region-aware legal review. Define events and retention. Respect applicable consent/opt-out rules. Admin metrics must be reproducible and tested against known fixtures.
- Performance: aggregate server-side with indexed queries/materialized rollups where needed; paginate/filter admin tables; rate limit exports and sensitive actions; no service-role credentials in browser. Admin UI must use same locale and theme infrastructure as the public app, with EN fallback.
- Admin acceptance: non-admin receives 403 for direct URLs and APIs; support/editor/analyst cannot mutate credits; only owner/admin with explicit credit-adjustment permission can grant or revoke; owner bootstrap is secure; audit logs record admin mutations; date/currency calculations reconcile against fixtures; no cross-user PII leak.

## 15. Public blog, editorial CMS and SEO (required in v1)

- Public routes: `/{locale}/blog`, `/{locale}/blog/{slug}`; optional category/tag listings only when there is substantial original content. Admin CMS routes live under `/admin/blog` and are protected as above.
- Blog content model: id, canonical content group/translation group id, locale, localized slug, title, excerpt, body (sanitized structured content/Markdown), author display name, category, tags, cover image metadata and alt text, SEO title/description, canonical override (reviewed), publication status (`draft`, `review`, `scheduled`, `published`, `archived`), published_at, updated_at, revision history, editor/publisher IDs. Unique locale+slug. Drafts never appear in sitemap or public APIs.
- Editorial workflow: create, edit, preview, review, schedule, publish, unpublish, archive, and safely restore previous versions. Publishing requires validation, safe HTML/Markdown rendering, image upload restrictions, alt text and editorial approval. Scheduling uses UTC with explicit timezone display and a reliable worker; do not claim scheduling works until tested.
- International blog strategy: English-first original, expert-reviewed posts; translate selectively into supported locales with human review. Never automatically publish machine translations. Missing translations should not yield empty pages or false hreflang pairs. Provide a locale-aware link to available original-language article or a localized blog index.
- SEO: per-post unique metadata, canonical, Open Graph, `Article`/`BlogPosting` structured data with real dates/authors, breadcrumb markup, sitemap only for published indexable URLs, hreflang only for existing translations, internal links to relevant Jobvion CV builder/templates. No keyword stuffing, scraped articles, invented expertise, fake reviews or bulk AI spam.
- Initial editorial plan: 5 genuinely useful English articles covering ATS-friendly resumes, tailoring a CV to a job, software developer resume examples, cover letter writing and common resume mistakes. Mark unpublished placeholders `TODO(content)` until reviewed. Never imply search ranking or traffic guarantees.
- Privacy/accessibility/performance: minimal analytics, accessible headings, responsive layout, image optimization, caching with invalidation on publish/unpublish, safe external links and strict XSS sanitization. Public blog pages work without login and respect system theme and locale selection.
- Blog acceptance: only published posts appear publicly and in sitemap; draft preview requires authorization; scheduled publishing works; XSS payloads are inert; slug uniqueness enforced; valid article metadata and hreflang; no broken locale fallback.

## 16. Launch quality gates for global behavior

1. Fresh browser `Accept-Language: de-DE,de;q=0.9,en;q=0.8` visiting `/` resolves to `/de`; unsupported `ja-JP` falls back to `/en`.
2. Explicit `/en` stays English regardless of browser language. Selector choice persists across reloads and sign-in, including on mobile.
3. First visit with dark OS theme paints dark before hydration; changing OS theme updates only when selection is System; Light/Dark manual override wins and persists.
4. CV preview and PDF stay white in both UI themes.
5. Locale switch preserves user-entered drafts; CV language can differ from UI language.
6. All supported locale URLs have valid canonical, hreflang, translated metadata and no broken message keys.
7. Currency, time zone, phone/address formatting and translations have regression tests; payment total always matches Paddle.
8. Privacy notices and terms are localized drafts and jurisdiction-specific obligations are tracked for legal sign-off; non-essential tracking respects applicable consent rules.


---

# PART II — PHASE-BY-PHASE BUILD PROMPTS

# Build prompts (copy one phase at a time)

Rules of thumb:
- Keep this unified file as `CLAUDE.md` in the repo root and put `credits_schema.sql` in `supabase/migrations/` first.
- ONE phase per session. Review the diff, run the tests, commit, then move on.
- Always start a phase in **plan mode**: "show a plan first, wait for my approval."
- Use test data only. Never paste real API keys or real user data into the chat.

---

## Phase 0 — Plan only (no code)

```
Read this entire unified CLAUDE.md (including Parts I and II), and supabase/migrations/credits_schema.sql.
Do NOT write code yet. Produce:
1. The exact current patched stable Next.js version you will use (check official security advisories) and a list of every dependency you plan to add, with one-line justifications.
2. The repo/folder structure.
3. A milestone plan for Phases 1–9 matching CLAUDE.md scope (v1 only), including global-first locale negotiation, system theme default, international SEO, protected admin analytics, editorial blog/CMS and region-aware legal review.
4. Every assumption you are making and every open question for me.
Wait for my answers before starting.
```

## Phase 1 — Foundation

```
Implement Phase 1 as described in CLAUDE.md.
- Scaffold Next.js (App Router, TS strict), Tailwind, shadcn/ui, next-intl (EN/TR/DE/FR/ES/IT/PT/NL, locale in URL); browser-language negotiation at root, saved override, EN fallback, no IP-based locale detection.
- Validated env schema + .env.example.
- Supabase client setup (server/browser separation), Auth with email + Google, session verification helpers for server code.
- Apply credits_schema.sql as a migration. Add a seed/test script.
- Theme system: tokens.css/design.md from the palette in CLAUDE.md, system-default light/dark/system toggle with no flash, persistence and live OS theme updates, then use the Hallmark skill for the app shell (header, footer, auth pages).
- Security headers in next.config, global error handling, Sentry wiring (PII scrubbed).
Acceptance: browser-language fallback and saved locale override tests pass; system/light/dark preference and first-paint tests pass; app runs locally; login works; a Vitest test proves RLS isolation (user A cannot read user B) and that concurrent spend_credits calls never overdraw; Lighthouse accessibility >= 95 on auth pages in both themes.
Plan first, wait for approval.
```

## Phase 2 — Profile, templates, PDF

```
Implement Phase 2.
- Profile JSON schema (Zod, with schema_version): personal info, summary, experience, education, skills, languages, certificates, projects. Autosave drafts.
- Profile editor: form on the left, live CV preview on the right (stacked on mobile). Preview is always white paper.
- 3 ATS-safe templates (single column, standard headings from the per-language dictionary, Turkish characters correct), with template metadata (ats_safe, columns, supports_photo, languages, tier).
- CV languages TR, EN, DE, FR, ES, IT, PT, NL: heading dictionaries, date/phone/page-size formats. No salary field. Optional photo only where the template supports it.
- PDF export through an isolated renderer service (JS disabled, network blocked except bundled fonts/data URIs, low-privilege, timeouts). Provide a Dockerfile.
- Automated ATS test: extract text from the generated PDF and assert heading names and reading order.
Acceptance: a long Turkish and a long German profile both render without broken layout or missing characters; PDF text extraction test passes.
Plan first, wait for approval.
```

## Phase 3 — Job analysis, tailoring, cover letter (the core)

```
Implement Phase 3.
- Job input: pasted text only (max length enforced). Treat it as untrusted data.
- lib/llm provider abstraction (config-driven model/base URL), timeouts, retries, per-call token+cost logging into llm_calls.
- Prompts in lib/prompts/ (versioned): job analysis -> JSON schema; match report (matching/missing keywords); tailored CV; cover letter. All prompts enforce: never add facts not in the profile; JSON-only output.
- PII placeholdering: replace name/phone/email/address with placeholders before the LLM call, re-insert after.
- Post-generation fact verifier: every company, title, date, degree and number in the output must exist in the profile snapshot, otherwise reject/regenerate.
- UI: match report first, user approves, then generation. Show a diff vs. the profile; user can edit before saving. Max 3 regenerations per credit.
- Credits: reset_free_credits -> spend_credits -> LLM calls -> on failure reverse_spend; on success record generation_runs. Idempotency keys on all spends.
- Global daily spend cap + rate limits per user/IP.
Acceptance: unit tests for the fact verifier (including a deliberately fabricated output), credit flow (insufficient credits, failure rollback, duplicate request), prompt-output schema validation; a prompt-injection test where the job text says "ignore previous instructions" does not change behavior.
Plan first, wait for approval.
```

## Phase 4 — Paddle checkout, webhooks, refunds

```
Implement Phase 4. Verify event names and payload shapes in the official Paddle Billing docs before coding; tell me if anything in CLAUDE.md contradicts the docs.
- Pricing page with the 3 packs (USD base, Paddle handles local currency). Map packs to paddle_price_id via credit_packages.
- Create the transaction server-side with custom_data containing our user id; open checkout with that transaction.
- Webhook route: verify signature on the raw body, dedupe via paddle_events.event_id, handle completed payments (grant_purchase) and refunds/adjustments (apply_refund), idempotent, safe logging.
- Account page: credit balance (free/paid), purchase history, ledger view, cancel/refund help links, refund policy link.
- Email notifications for purchase and refund.
Acceptance: tests for duplicate webhooks, invalid signatures, unknown package, full and partial refund, refund after credits were spent (flagging).
Plan first, wait for approval.
```

## Phase 5 — Privacy, legal, account deletion

```
Implement Phase 5 per the Global Privacy section of CLAUDE.md.
- Legal pages (TR + EN) as DRAFTS marked TODO(legal-review): localized Privacy Notice, jurisdiction-specific GDPR/KVKK supplements when applicable, Terms of Use, Refund Policy, Cookie Notice/controls when needed. Populate the processor list from config/processors.ts.
- Terms acceptance/version log, privacy notice delivery log, and separate opt-in logs only when legally appropriate.
- Account deletion flow with confirmation, grace period, hard delete job, and purchase anonymization.
- "Download all my data" export (JSON + PDFs).
- Data retention: scheduled cleanup of paddle_events payloads older than 90 days and orphaned storage files.
Acceptance: an end-to-end test that creates a user with CVs and a purchase, deletes the account, and verifies nothing personal remains (except anonymized purchases).
Do NOT use blanket cross-border-transfer consent as a substitute for legally valid transfer mechanisms. Flag jurisdiction-specific requirements for counsel.
```

## Phase 6 — Marketing pages and SEO

```
Implement Phase 6 per the SEO and Design sections of CLAUDE.md. Use the Hallmark skill.
- Home, pricing, template gallery (each template has its own page with a preview), a guides section, and 5 example guide pages with real, useful content (mark placeholders TODO(content)). No fake stats or testimonials.
- generateMetadata per page, canonical, hreflang for all supported UI locales and x-default, sitemap.ts, robots.ts, JSON-LD, Open Graph images.
- App area noindex and excluded from sitemap.
Acceptance: all 8 locale routes, canonical/hreflang/x-default and translated metadata verified; Lighthouse SEO >= 95 and Performance >= 90 on marketing pages (mobile); valid hreflang; `hallmark audit` findings addressed.
```

## Phase 7 — Admin console, reporting and access controls

```
Implement Phase 7 as described in the Admin Console section of CLAUDE.md. Show a plan and permission matrix first; wait for approval.
- Create server-enforced admin roles and secure owner bootstrap. No self-service role escalation.
- Build overview, analytics, AI usage, finance, credits, users, system health and audit screens with locale/theme support.
- Aggregate existing credit, generation, LLM and Paddle data; document KPI definitions, cost assumptions, currencies and refresh cadence. Add only necessary safe aggregate events and migrations.
- Include filters by date, model, locale and status where supported. Make empty states truthful; label estimates.
- Implement least-privilege user support and a protected admin credit-management screen: grant promotional credits, revoke unspent manual grants, inspect ledger/history, require reason + confirmation, and record immutable audit events. Use atomic idempotent server-side ledger operations; do not edit balances directly. Never add a separate test-credit bucket.
- Verify owner/admin permissions, negative-balance prevention, duplicate requests, audit history, and revenue exclusion for grants. Maintain provider cost caps. Implement any missing database functions only after inspecting credits_schema.sql and obtaining approval for schema changes.
- Add MFA plan and audit logs.
Acceptance: all non-admin direct access denied, role separation tested, authorized grants/revocations are atomic and audited, double-submit cannot duplicate credits, revocations cannot create negative balances, grants do not inflate revenue, calculations reconciled with fixture data, no CV contents or service keys exposed.
```

## Phase 8 — Public blog and admin CMS

```
Implement Phase 8 as described in the Blog section of CLAUDE.md. Show plan first; wait for approval.
- Build localized public blog index/article routes and accessible responsive layouts.
- Add blog tables, safe content renderer, images, tags/categories, draft/review/schedule/publish workflow, preview, revisions and admin permissions.
- Add per-article metadata, canonical, hreflang only for actual translations, Article/BlogPosting JSON-LD, sitemap updates and cache invalidation.
- Prepare five original English editorial drafts with TODO(content-review); never auto-publish unreviewed AI content.
Acceptance: drafts private, editor/publisher roles enforced, scheduled jobs tested, sanitized content resists XSS, SEO tags correct, published posts indexed only as intended.
```

## Phase 9 — Hardening and release checklist

```
Do a hardening pass across public app, admin console and blog.
- Verify security headers/CSP, rate limits (signup, login, generation, upload), Turnstile on signup, global LLM spend cap with alert, secret scanning, dependency audit, exact version pinning, Dependabot/Renovate config.
- Re-check that no secret reaches the client bundle and that credit functions are service_role only.
- Verify admin RBAC/MFA, audit log protection, reporting correctness, CMS publishing permissions, draft privacy and XSS sanitization.
- Run the full test suite and write a SECURITY_CHECKLIST.md with what was verified and what still needs a human.
- Write a RELEASE_CHECKLIST.md: legal review done?, global privacy data-flow map and transfer assessment ready?, admin owner provisioned and access reviewed?, blog editorial content reviewed?, Paddle seller approval?, backups?, monitoring/alerts?, test data purged?
Report anything you could not verify.
```

---

## Reusable review prompts

**Security review**
```
Act as an application security reviewer. Review the current diff/repo against the Security rules in CLAUDE.md and OWASP Top 10. List concrete findings with file/line, severity, and a fix. Specifically check: authz inside every handler/action, RLS gaps, secrets in client bundle, webhook verification, SSRF, XSS from LLM output, PDF renderer isolation, rate limits, logging of personal data. Do not change code; report only.
```

**Global privacy data-flow map (for legal review)**
```
Scan the repo and produce a table of every place personal data is collected, stored, or sent to a third party: data fields, purpose, storage location/region, recipient service, country, retention period, deletion mechanism. Compare it with config/processors.ts and flag any mismatch. Output as markdown. Do not make legal conclusions.
```

**Test generation**
```
For the module I name, write Vitest tests covering happy path, validation failures, authorization failures, idempotency/duplicates, and abuse cases. Do not modify production code unless a test reveals a real bug; if so, explain it first.
```

**Cost check**
```
Using llm_calls and generation_runs, compute average cost per credit and per generation step for the last N runs, worst-case cost, and the projected monthly cost of the free tier for 1,000 users. Suggest whether pack prices still leave a healthy margin after Paddle fees (5% + $0.50 per transaction).
```
