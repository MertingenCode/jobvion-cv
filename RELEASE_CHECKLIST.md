# Jobvion release checklist

- Apply pending Supabase migrations in staging, then deploy the web app and private PDF worker.
- Set the Paddle environment, approved checkout URL, seller credentials, package prices and signed webhook destination. Verify sandbox purchase and refund with real provider events.
- Verify email and SMS one-time codes, Google and Apple OAuth, Turnstile, application generation and the PDF worker with configured staging services.
- Add scheduled POST requests for publication and maintenance. Verify retry alerts and clock behavior.
- Review the English and Turkish legal drafts, document processor agreements and transfer arrangements, and confirm the rights request and incident channels.
- Provision the first admin owner using the bootstrap script. Confirm MFA and review role assignments. Review draft blog articles before editorial publication.
- Restore a staging backup, verify retention in each service, check monitoring and purge staging test purchases and personal data before launch.
- Run mobile Lighthouse against the deployment and verify the SEO and performance targets.

## Local verification

- Production build and lint passed. The 43-test suite included PostgreSQL accounting and real Chromium PDF generation.
- All 17 Playwright scenarios passed, including single-page pricing, public previews, eight-locale editorial routes and anonymous access controls.
- The redesign was rendered at mobile and desktop widths. The sample Essential PDF was checked for selectable text in reading order.
- Production credentials, signed live or sandbox Paddle deliveries, external LLM responses, Supabase Auth CAPTCHA, email delivery, backups, schedules and operational alerts require staging verification.
- The five guides and two starter blog articles have full text in all eight UI languages. Legal drafts are available in English and Turkish.

## Personal data and access

| Data | Store or recipient | Deletion or retention |
| --- | --- | --- |
| Authentication identity and locale | Supabase Auth, Google or Apple if selected, configured SMS provider for phone codes | Auth deletion removes the account. Confirm provider-side retention and backups. |
| Profile, saved CVs, normalized portrait, job analyses and application packs | Supabase PostgreSQL | Account deletion cascades to these rows. Photo originals are discarded after processing. |
| Requested PDF snapshot and optional portrait | Private Chromium renderer | Rendered in memory. Confirm production log scrubbing and worker region. |
| Job text, selected profile evidence and skills | Configured LLM provider | Contact fields are masked. Confirm actual provider terms, region and retention before activation. |
| Transaction and adjustment identifiers, order amount and currency | Paddle, Supabase PostgreSQL | Local purchases are detached from deleted accounts. Webhook payloads are cleared after 90 days. Confirm provider retention. |
| Promotional adjustments, admin and editorial activity | Supabase PostgreSQL | Account-linked grants cascade. Audit records retain operation details and detach deleted actors. |
| Abuse and operational metadata | Upstash, Turnstile, optional Sentry | Confirm configured regions, TTL, scrubbing and access. |
| Browser preferences and authorization session | First-party cookies and CV editor tab storage | Clear via browser controls or sign out for the session. |

Processor regions are deployment-specific. The processor list and draft notices are maintained in the app.
