import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { serverSupabase } from "@/lib/supabase/server";
import { isAdminRole, permitted, type AdminPermission } from "@/lib/admin/roles";
import type { Locale } from "@/i18n/config";

export const adminSession = cache(async () => {
  const supabase = await serverSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  const id = data?.claims.sub;
  if (error || typeof id !== "string") return null;
  const { data: membership } = await supabase.from("admin_memberships").select("role").eq("user_id", id).maybeSingle();
  if (!isAdminRole(membership?.role)) return null;
  return { supabase, id, role: membership.role, mfa: data?.claims.aal === "aal2" };
});

export async function requireAdmin(locale: Locale, permission?: AdminPermission) {
  const session = await adminSession();
  if (!session || (permission && !permitted(session.role, permission))) notFound();
  if (!session.mfa) redirect(`/${locale}/admin/mfa`);
  return session;
}
