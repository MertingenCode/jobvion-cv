"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminSession } from "@/lib/admin/access";
import { permitted } from "@/lib/admin/roles";
import { isLocale, type Locale } from "@/i18n/config";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { blogContent, operations, utcSchedule } from "@/lib/blog/schema";

export type AdminResult = "invalid" | "limited" | "failed" | "conflict" | "saved" | "denied";
type SaveState = AdminResult | null;

export async function saveBlog(locale: Locale, postId: string | null, revision: number | null, _state: SaveState, form: FormData): Promise<SaveState> {
  if (!isLocale(locale) || (postId !== null && !z.uuid().safeParse(postId).success)) return "invalid";
  const session = await adminSession();
  if (!session?.mfa || !permitted(session.role, "write")) return "denied";
  if (!await allowAuthAttempt("editorial", session.id)) return "limited";
  const values = Object.fromEntries([...form.entries()].filter(([name]) => !name.startsWith("$ACTION_")));
  const tags = values.tags;
  const payload = blogContent.safeParse({
    ...values,
    translation_group: values.translation_group || null,
    tags: typeof tags === "string" && tags.length <= 300 ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : null,
  });
  if (!payload.success) return "invalid";
  const { data, error } = await session.supabase.rpc("change_blog_post", {
    p_id: postId, p_revision: revision, p_action: "save", p_content: payload.data,
  });
  if (error?.code === "40001" || error?.code === "23505") return "conflict";
  if (error || !z.uuid().safeParse(data).success) return "failed";
  redirect(`/${locale}/admin/blog/${data}?notice=saved`);
}

export async function transitionBlog(locale: Locale, postId: string, revision: number, form: FormData) {
  if (!isLocale(locale) || !z.uuid().safeParse(postId).success) return;
  const page = `/${locale}/admin/blog/${postId}`;
  const session = await adminSession();
  if (!session?.mfa || !permitted(session.role, "write")) return;
  const operation = z.enum(operations).safeParse(form.get("operation"));
  if (!operation.success) redirect(page + "?notice=invalid");
  const action = operation.data;
  if (action !== "review" && !permitted(session.role, "publish")) return;
  if (!await allowAuthAttempt("editorial", session.id)) redirect(page + "?notice=limited");
  const needsConfirm = ["publish", "unpublish", "archive", "restore", "schedule"].includes(action);
  if (needsConfirm && form.get("confirm") !== "on") redirect(page + "?notice=invalid");

  const time = form.get("schedule");
  const restore = form.get("revision");
  const schedule = typeof time === "string" ? utcSchedule(time) : null;
  const restoreId = typeof restore === "string" && /^\d{1,9}$/.test(restore) ? Number(restore) : null;
  if ((action === "schedule" && !schedule) || (action === "restore" && !restoreId)) redirect(page + "?notice=invalid");

  const { error } = await session.supabase.rpc("change_blog_post", {
    p_id: postId, p_revision: revision, p_action: action,
    p_schedule: schedule, p_restore: restoreId,
  });
  redirect(page + "?notice=" + (error?.code === "40001" ? "conflict" : error ? "failed" : "saved"));
}

const roleInput = z.strictObject({
  account: z.uuid(),
  role: z.enum(["none", "admin", "editor", "support", "analyst"]),
  confirm: z.literal("on"),
});

export async function changeRole(locale: Locale, form: FormData) {
  if (!isLocale(locale)) return;
  const session = await adminSession();
  if (!session?.mfa || !permitted(session.role, "roles")) return;
  const destination = `/${locale}/admin/roles?notice=`;
  if (!await allowAuthAttempt("admin", session.id)) redirect(destination + "limited");
  const input = roleInput.safeParse({ account: form.get("account"), role: form.get("role"), confirm: form.get("confirm") });
  if (!input.success) redirect(destination + "invalid");
  const { error } = await session.supabase.rpc("assign_admin_role", {
    p_user: input.data.account, p_role: input.data.role === "none" ? null : input.data.role,
  });
  redirect(destination + (error ? "failed" : "saved"));
}

const accountSchema = z.object({
  id: z.uuid(), createdAt: z.string(), free: z.number().nullable(),
  paid: z.number().nullable(), purchases: z.number(),
});
export type AccountState = { account?: z.infer<typeof accountSchema>; notice?: AdminResult | "noAccount" };

export async function findAccount(_state: AccountState, form: FormData): Promise<AccountState> {
  const session = await adminSession();
  if (!session?.mfa || !permitted(session.role, "accounts")) return { notice: "denied" };
  if (!await allowAuthAttempt("admin", session.id)) return { notice: "limited" };
  const email = z.email().max(254).safeParse(form.get("email"));
  if (!email.success) return { notice: "invalid" };
  const { data, error } = await session.supabase.rpc("admin_lookup_account", { p_email: email.data });
  if (error) return { notice: "failed" };
  if (data === null) return { notice: "noAccount" };
  const result = accountSchema.safeParse(data);
  return result.success ? { account: result.data } : { notice: "failed" };
}
