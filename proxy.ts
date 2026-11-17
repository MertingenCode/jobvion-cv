import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isLocale, localeCookie, negotiateLocale } from "@/i18n/config";
import { readEnv } from "@/lib/env";
import { contentSecurityPolicy } from "@/lib/security/headers";
import { preferenceCookie } from "@/lib/security/preferences";

export async function proxy(request: NextRequest) {
  const url = request.nextUrl;
  if (url.pathname === "/") {
    url.pathname = "/" + negotiateLocale(request.cookies.get(localeCookie)?.value, request.headers.get("accept-language"));
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("Vary", "Accept-Language, Cookie");
    redirect.headers.set("Cache-Control", "private, no-store");
    return redirect;
  }

  const env = readEnv();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = contentSecurityPolicy(nonce, env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const locale = url.pathname.split("/")[1];
  if (isLocale(locale) && env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      request.cookies.getAll().some(({ name }) => /^sb-.+-auth-token(?:\.\d+)?$/.test(name))) {
    const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      cookieOptions: preferenceCookie(env.APP_ORIGIN),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name, value } of cookies) request.cookies.set(name, value);
          requestHeaders.set("cookie", request.cookies.toString());
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookies) response.cookies.set(name, value, options);
        },
      },
    });
    await supabase.auth.getClaims();
  }

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/|favicon.ico|.*\\.[^/]+$).*)"] };
