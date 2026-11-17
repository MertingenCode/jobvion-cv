export const processors=[
  {system:"Apple OAuth",purpose:"Optional sign-in and account identity",region:"Confirm provider terms and transfer arrangements"},
  {system:"Configured SMS provider",purpose:"Send one-time sign-in codes using the supplied phone number",region:"Confirm provider, delivery regions and retention"},
  {system:"Google OAuth",purpose:"Optional sign-in and account identity",region:"Confirm provider terms and transfer arrangements"},
  {system:"Supabase",purpose:"Auth, profiles, CVs, credits, orders and editorial records",region:"EU Frankfurt deployment target; verify the actual project"},
  {system:"Configured LLM provider",purpose:"Minimized job and profile text for analysis and selection",region:"Verify contract, processing locations and transfer basis before launch"},
  {system:"Paddle",purpose:"Checkout, financial records, receipts and refund notices",region:"Confirm seller, payment and retention arrangements"},
  {system:"Cloudflare Turnstile",purpose:"Signup and login abuse screening when configured",region:"Verify deployment and transfer arrangements"},
  {system:"Upstash",purpose:"Request rate limiting using hashed subject keys",region:"Verify configured region"},
  {system:"Sentry",purpose:"Optional scrubbed error telemetry",region:"Verify project region and scrubbing"},
  {system:"Private Chromium worker",purpose:"Render a single user-requested PDF in memory",region:"Verify host location and egress controls"},
] as const;
