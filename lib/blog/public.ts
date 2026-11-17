import "server-only";
import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { readEnv } from "@/lib/env";
import { blogPost, blogSummary, type BlogSummary } from "@/lib/blog/schema";
import { starterPost, starterPosts } from "@/lib/content/blog-starter";
import { locales, type Locale } from "@/i18n/config";

const linkSchema = z.object({ locale: z.enum(locales), slug: z.string(), updated_at: z.string(), translation_group: z.uuid() });

function publicBlog() {
  const env = readEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return null;
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
}

const summaryFields = Object.keys(blogSummary.shape).join(",");
export const publicPosts = cache(async (locale: Locale) => {
  const db = publicBlog();
  const examples = starterPosts(locale);
  if (!db) return { posts: examples, unavailable: false };
  const { data, error } = await db.from("blog_posts").select(summaryFields)
    .eq("status", "published").eq("locale", locale).order("published_at", { ascending: false }).order("id").limit(50);
  const result = z.array(blogSummary).safeParse(data);
  if (error || !result.success) return { posts: examples, unavailable: true };
  const posts: BlogSummary[] = [...result.data, ...examples.filter(({ slug }) => !result.data.some((item) => item.slug === slug))];
  return { posts, unavailable: false };
});

export const publicPost = cache(async (locale: Locale, slug: string) => {
  const db = publicBlog();
  const example = starterPost(locale, slug);
  if (!db) return example;
  const { data, error } = await db.from("blog_posts").select("*").eq("status", "published")
    .eq("locale", locale).eq("slug", slug).maybeSingle();
  if (error && !example) throw new Error("Published article could not be loaded.");
  return data ? blogPost.parse(data) : example;
});

export async function publishedLinks(group?: string) {
  const examples = locales.flatMap(starterPosts).filter((post) => !group || post.translation_group === group)
    .map(({ locale, slug, updated_at, translation_group }) => ({ locale, slug, updated_at, translation_group }));
  const db = publicBlog();
  if (!db) return examples;
  let query = db.from("blog_posts").select("locale,slug,updated_at,translation_group").eq("status", "published");
  if (group) query = query.eq("translation_group", group);
  const { data, error } = await query.order("id").limit(group ? locales.length : 1000);
  const result = z.array(linkSchema).safeParse(data);
  if (error || !result.success) return examples;
  return [...result.data, ...examples.filter((example) =>
    !result.data.some((post) => post.locale === example.locale && post.slug === example.slug))];
}
