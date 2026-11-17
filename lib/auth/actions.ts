"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, type Locale } from "@/i18n/config";
import { readEnv } from "@/lib/env";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { signupChallengeRequired, signupSiteKey } from "@/lib/auth/turnstile";
import { reconcileLocale } from "@/lib/auth/locale";
import { serverSupabase } from "@/lib/supabase/server";

const emailInput = z.string().trim().max(254).pipe(z.email()).transform((email) => email.toLowerCase());
const phoneInput = z.string().trim().max(32).transform((phone) => phone.replace(/[ ().-]/g, ""))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/));
const otpInput = z.string().trim().regex(/^\d{6}$/);
type Channel = "email" | "sms";
export type AuthStatus = "invalid" | "unavailable" | "limited" | "failed" | "sent" | "codeInvalid" | "challenge" | null;

function callbackUrl(locale: Locale) {
  const url = new URL("/auth/callback", readEnv().APP_ORIGIN);
  url.searchParams.set("locale", locale);
  return url.href;
}

export async function otpAuth(
  locale: Locale,
  mode: "login" | "signup",
  channel: Channel,
  _previous: AuthStatus,
  form: FormData,
): Promise<AuthStatus> {
  if (!isLocale(locale) || (mode !== "login" && mode !== "signup") || (channel !== "email" && channel !== "sms")) return "invalid";
  const operation = form.get("operation");
  const contact = (channel === "email" ? emailInput : phoneInput).safeParse(form.get("contact"));
  if (!contact.success || (operation !== "send" && operation !== "verify")) return "invalid";
  const supabase = await serverSupabase();
  if (!supabase) return "unavailable";
  if (operation === "verify") {
    const code = otpInput.safeParse(form.get("code"));
    if (!code.success) return "codeInvalid";
    if (!await allowAuthAttempt("otp-verify", contact.data)) return "limited";
    const { data, error } = await supabase.auth.verifyOtp(channel === "email"
      ? { email: contact.data, token: code.data, type: "email" }
      : { phone: contact.data, token: code.data, type: "sms" });
    if (error || !data.user || !data.session) return "codeInvalid";
    await reconcileLocale(supabase, locale, data.user.user_metadata.jobvion_locale);
    redirect(`/${locale}/app`);
  }

  if (!await allowAuthAttempt("otp-send", contact.data)) return "limited";
  const siteKey = signupSiteKey();
  if (signupChallengeRequired() && !siteKey) return "unavailable";
  const token = z.string().min(1).max(2048).safeParse(form.get("cf-turnstile-response"));
  if (siteKey && !token.success) return "challenge";

  const options = { shouldCreateUser: mode === "signup", captchaToken: token.data, data: { jobvion_locale: locale } };
  const { error } = await supabase.auth.signInWithOtp(channel === "email"
    ? { email: contact.data, options: { ...options, emailRedirectTo: callbackUrl(locale) } }
    : { phone: contact.data, options: { ...options, channel: "sms" } });
  if (!error || ["otp_disabled", "user_not_found", "user_already_exists"].includes(error.code ?? "")) return "sent";
  if (error.status === 429) return "limited";
  if (error.code === "captcha_failed") return "challenge";
  if (["phone_provider_disabled", "email_provider_disabled", "sms_send_failed", "over_sms_send_rate_limit"].includes(error.code ?? "")) {
    return "unavailable";
  }
  return "failed";
}

export async function socialAuth(locale: Locale, provider: "google" | "apple") {
  if (!isLocale(locale)) redirect("/en/login");
  if (provider !== "google" && provider !== "apple") redirect(`/${locale}/login?status=failed`);
  const supabase = await serverSupabase();
  if (!supabase) redirect(`/${locale}/login?status=unavailable`);
  if (!await allowAuthAttempt("oauth")) redirect(`/${locale}/login?status=limited`);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider, options: { redirectTo: callbackUrl(locale) },
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
