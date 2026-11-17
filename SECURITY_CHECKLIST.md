# Jobvion security checklist

## Local controls

- The proxy applies a nonce CSP. Script execution requires a nonce or a trusted parent script. Paddle and Turnstile are the external frame and connection origins used by the application.
- Server-side verification applies to session checks, CV and account access, application packs, admin roles and AAL2, and Paddle signatures over raw request bytes.
- PostgreSQL limits direct credit mutation to the service role. The promotions and blog RPCs validate the authenticated caller’s role and MFA separately.
- Text and structured outputs use bounded schemas. Application tailoring selects existing profile fields. Photos and cover images are re-encoded as bounded JPEGs. Markdown comes from the existing restricted renderer.
- Login, signup, rendering, profile images, application generation, billing and account requests have rate-limit buckets. The daily LLM reservation is atomic and uses UTC.
- The renderer runs on its separate private service. Dependency versions are pinned and Dependabot monitors package and workflow files.

The dependency audit currently reports GHSA-fc5q-39xc-vjpf in two installed picomatch versions and their transitive dependents. The npm registry did not offer a version outside the affected range at verification time. Recheck this advisory before publishing.

## Production checks

- Confirm the reverse proxy overwrites the trusted IP header and that Upstash denies excess requests.
- Enable Turnstile in Supabase Auth and verify email and SMS code delivery, verification, Google and Apple callbacks, and rate limits on the production domain.
- Validate Paddle webhook delivery, approved adjustments, and receipt and refund emails in sandbox before enabling live credentials.
- Monitor LLM budget warnings, failed Paddle events, deletion retries and provider errors. Wire deployment logs to operational alerts.
- Confirm secret custody and rotation, DB recovery, owner MFA, live CMS permissions and public/draft image behavior.
