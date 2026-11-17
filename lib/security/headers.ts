export function contentSecurityPolicy(nonce: string, supabaseUrl: string | undefined, development: boolean) {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  return [
    "default-src 'self'",
    ["script-src", "'self'", `'nonce-${nonce}'`, "'strict-dynamic'", development ? "'unsafe-eval'" : ""].filter(Boolean).join(" "),
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    ["connect-src", "'self'", supabase].filter(Boolean).join(" "),
    "object-src 'none'",
    "base-uri 'none'",
    ["form-action", "'self'", supabase, supabase ? "https://accounts.google.com" : ""].filter(Boolean).join(" "),
    "frame-ancestors 'none'",
  ].join("; ");
}
