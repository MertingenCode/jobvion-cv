import "server-only";
import { redirect } from "next/navigation";
import type { Locale } from "@/i18n/config";
import { serverSupabase } from "@/lib/supabase/server";

export async function verifiedUserId() {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  return !error && typeof id === "string" ? id : null;
}

export async function requireUser(locale: Locale) {
  const id = await verifiedUserId();
  if (!id) redirect(`/${locale}/login`);
  return id;
}
