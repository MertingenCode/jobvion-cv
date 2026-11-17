import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/access";
import { blogPost } from "@/lib/blog/schema";
import type { Locale } from "@/i18n/config";

export async function editorPost(locale: Locale, id: string) {
  const session = await requireAdmin(locale, "write");
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await session.supabase.from("blog_posts").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Article could not be loaded.");
  if (!data) notFound();
  return { ...session, post: blogPost.parse(data) };
}
