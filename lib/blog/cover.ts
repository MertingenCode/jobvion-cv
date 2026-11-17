import "server-only";
import { cache } from "react";
import { readEnv } from "@/lib/env";
import { serviceSupabase } from "@/lib/supabase/admin";

export function coverUrl(id: string) {
  return "/api/blog/cover/" + id;
}

export const coverAlt = cache(async (id: string, publishedOnly = false) => {
  if (!readEnv().SUPABASE_SERVICE_ROLE_KEY) return null;
  const db = serviceSupabase();
  const { data } = publishedOnly
    ? await db.from("blog_covers").select("alt,blog_posts!inner(status)").eq("post_id", id)
      .eq("blog_posts.status", "published").maybeSingle()
    : await db.from("blog_covers").select("alt").eq("post_id", id).maybeSingle();
  return typeof data?.alt === "string" ? data.alt : null;
});
