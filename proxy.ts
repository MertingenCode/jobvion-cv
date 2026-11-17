import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { isLocale, localeCookie, negotiateLocale } from "@/i18n/config";
import { readEnv } from "@/lib/env";
import { contentSecurityPolicy } from "@/lib/security/headers";
import { isAdminRole } from "@/lib/admin/roles";
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

  if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
    const locale = negotiateLocale(request.cookies.get(localeCookie)?.value, request.headers.get("accept-language"));
    url.pathname = "/" + locale + url.pathname;
    return NextResponse.redirect(url, { status: 307, headers: { "Cache-Control": "private, no-store" } });
  }

  const env = readEnv();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const [, locale, segment] = url.pathname.split("/");

  const csp = contentSecurityPolicy(nonce, env.NEXT_PUBLIC_SUPABASE_URL, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-jobvion-nonce", nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const adminRoute = isLocale(locale) && segment === "admin";
  let adminAllowed = false;
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
    const { data } = await supabase.auth.getClaims();
    const user = data?.claims.sub;
    if (adminRoute && typeof user === "string") {
      const { data: record } = await supabase.from("admin_memberships").select("role").eq("user_id", user).maybeSingle();
      adminAllowed = isAdminRole(record?.role);
    }
  }

  if (adminRoute && !adminAllowed) {
    return new NextResponse(null, { status: 403, headers: {
      "Content-Security-Policy": csp,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    } });
  }

  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/((?!_next/|favicon.ico|.*\\.[^/]+$).*)"] };
