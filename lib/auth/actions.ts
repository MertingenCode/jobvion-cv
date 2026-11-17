"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, type Locale } from "@/i18n/config";
import { readEnv } from "@/lib/env";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { signupChallengeRequired, signupSiteKey } from "@/lib/auth/turnstile";
import { reconcileLocale } from "@/lib/auth/locale";
import { serverSupabase } from "@/lib/supabase/server";

const credentials = z.strictObject({
  email: z.email().max(254).transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(72).refine((password) => new TextEncoder().encode(password).byteLength <= 72),
});
const signupPassword = z.string().min(8);

export type AuthStatus = "invalid" | "unavailable" | "limited" | "failed" | "confirm" | null;

function callbackUrl(locale: Locale) {
  const url = new URL("/auth/callback", readEnv().APP_ORIGIN);
  url.searchParams.set("locale", locale);
  return url.href;
}

export async function emailAuth(
  locale: Locale,
  mode: "login" | "signup",
  _previous: AuthStatus,
  form: FormData,
): Promise<AuthStatus> {
  if (!isLocale(locale) || (mode !== "login" && mode !== "signup")) return "invalid";
  const values = credentials.safeParse(Object.fromEntries(
    Array.from(form.entries()).filter(([key]) => !key.startsWith("$ACTION_") && key !== "cf-turnstile-response"),
  ));
  if (!values.success || (mode === "signup" && !signupPassword.safeParse(values.data.password).success)) {
    return "invalid";
  }
  const supabase = await serverSupabase();
  if (!supabase) return "unavailable";
  if (!await allowAuthAttempt(mode, values.data.email)) return "limited";


  const siteKey = signupSiteKey();
  if (signupChallengeRequired() && !siteKey) return "unavailable";
  const token = z.string().min(1).max(2048).safeParse(form.get("cf-turnstile-response"));
  if (siteKey && !token.success) return "failed";

  if (mode === "signup") {
    const { data, error } = await supabase.auth.signUp({
      ...values.data,
      options: { captchaToken: token.data, emailRedirectTo: callbackUrl(locale), data: { jobvion_locale: locale } },
    });
    if (error && error.code !== "user_already_exists") return "failed";
    if (!data.session) return "confirm";
    await reconcileLocale(supabase, locale, data.user?.user_metadata.jobvion_locale);
    redirect(`/${locale}/app`);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ ...values.data, options: { captchaToken: token.data } });
  if (error) return "failed";
  await reconcileLocale(supabase, locale, data.user?.user_metadata.jobvion_locale);
  redirect(`/${locale}/app`);
}

export async function googleAuth(locale: Locale) {
  if (!isLocale(locale)) redirect("/en/login");
  const supabase = await serverSupabase();
  if (!supabase) redirect(`/${locale}/login?status=unavailable`);
  if (!await allowAuthAttempt("oauth")) redirect(`/${locale}/login?status=limited`);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(locale) },
  });
  if (error || !data.url) redirect(`/${locale}/login?status=failed`);
  redirect(data.url);
}

export async function signOut(locale: Locale) {
  if (!isLocale(locale)) redirect("/en");
  const supabase = await serverSupabase();
  const claims = await supabase?.auth.getClaims();
  if (claims?.data?.claims.sub) await supabase?.auth.signOut({ scope: "local" });
  redirect(`/${locale}/login`);
}
