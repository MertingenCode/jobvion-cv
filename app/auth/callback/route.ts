import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { defaultLocale, isLocale } from "@/i18n/config";
import { reconcileLocale } from "@/lib/auth/locale";
import { readEnv } from "@/lib/env";
import { serverSupabase } from "@/lib/supabase/server";

const callback = z.strictObject({
  locale: z.string().max(2).optional(),
  code: z.string().min(1).max(512).optional(),
  token_hash: z.string().min(1).max(512).optional(),
  type: z.literal("email").optional(),
}).refine(({ code, token_hash, type }) => Boolean(code && !token_hash && !type || !code && token_hash && type));

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const requestedLocale = search.get("locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : defaultLocale;
  const origin = readEnv().APP_ORIGIN;
  const failure = new URL(`/${locale}/login?status=failed`, origin);
  const params = callback.safeParse(Object.fromEntries(search));
  if (!params.success) return NextResponse.redirect(failure);
  const supabase = await serverSupabase();
  if (!supabase) return NextResponse.redirect(failure);

  const { data, error } = params.data.code
    ? await supabase.auth.exchangeCodeForSession(params.data.code)
    : await supabase.auth.verifyOtp({ token_hash: params.data.token_hash!, type: "email" });

  if (error || !data.user) return NextResponse.redirect(failure);
  await reconcileLocale(supabase, locale, data.user.user_metadata.jobvion_locale);
  return NextResponse.redirect(new URL(`/${locale}/app`, origin));
}
