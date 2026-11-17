"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminSession } from "@/lib/admin/access";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { isLocale, type Locale } from "@/i18n/config";

export type MfaState = { secret?: string; factorId?: string; error?: "failed" | "invalid" | "limited" };

export async function enrollAdminMfa(): Promise<MfaState> {
  const session = await adminSession();
  if (!session || session.mfa) return { error: "failed" };
  if (!await allowAuthAttempt("mfa", session.id)) return { error: "limited" };
  const { data: factors, error } = await session.supabase.auth.mfa.listFactors();
  if (error || factors.totp.length) return { error: "failed" };
  const result = await session.supabase.auth.mfa.enroll({ factorType: "totp", issuer: "Jobvion" });
  return result.error ? { error: "failed" } : { secret: result.data.totp.secret, factorId: result.data.id };
}

export async function verifyAdminMfa(locale: Locale, factorId: string, _state: MfaState, form: FormData): Promise<MfaState> {
  if (!isLocale(locale) || !z.uuid().safeParse(factorId).success) return { error: "invalid" };
  const session = await adminSession();
  if (!session) return { error: "failed" };
  const code = z.string().regex(/^\d{6}$/).safeParse(form.get("code"));
  if (!code.success) return { error: "invalid" };
  if (!await allowAuthAttempt("mfa", session.id)) return { error: "limited" };
  const { error } = await session.supabase.auth.mfa.challengeAndVerify({ factorId, code: code.data });
  if (error) return { error: "failed" };
  redirect(`/${locale}/admin`);
}
