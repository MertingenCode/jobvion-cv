export function contentSecurityPolicy(nonce: string, supabaseUrl: string | undefined, development: boolean) {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  // A document's CSP also governs pages reached through client-side navigation.
  return [
    "default-src 'self'",
    ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", development ? "'unsafe-eval'" : ""].filter(Boolean).join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    ["connect-src", "'self'", supabase, "https://*.paddle.com", "https://challenges.cloudflare.com"].filter(Boolean).join(" "),
    "frame-src https://*.paddle.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'none'",
    ["form-action", "'self'", supabase, supabase ? "https://accounts.google.com" : ""].filter(Boolean).join(" "),
    "frame-ancestors 'none'",
  ].join("; ");
}
