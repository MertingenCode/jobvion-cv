import { z } from "zod";
import { locales } from "@/i18n/config";

export const statuses = ["draft", "review", "scheduled", "published", "archived"] as const;
export const operations = ["review", "publish", "unpublish", "schedule", "archive", "restore"] as const;
export const blogSlug = z.string().max(100).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const short = (maximum: number) => z.string().trim().min(1).max(maximum);

export const blogContent = z.strictObject({
  translation_group: z.uuid().nullable(),
  locale: z.enum(locales),
  slug: blogSlug,
  title: short(120),
  excerpt: short(300),
  body: short(30000),
  author: short(100),
  category: z.string().trim().max(60),
  tags: z.array(short(32)).max(8),
  seo_title: z.string().trim().max(120),
  seo_description: z.string().trim().max(300),
});

export const blogPost = blogContent.extend({
  id: z.uuid(),
  translation_group: z.uuid(),
  status: z.enum(statuses),
  updated_at: z.string(),
  published_at: z.string().nullable(),
  scheduled_at: z.string().nullable(),
  revision: z.number().int().positive(),
});

export const blogSummary = blogPost.pick({
  id: true, title: true, excerpt: true, locale: true, slug: true, status: true,
  updated_at: true, published_at: true, category: true, author: true,
});

export type BlogPost = z.infer<typeof blogPost>;
export type BlogSummary = z.infer<typeof blogSummary>;

export function utcSchedule(value: string) {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value)) return null;
  const date = new Date(value + ":00.000Z");
  return Number.isFinite(date.valueOf()) && date.toISOString().startsWith(value + ":") ? date.toISOString() : null;
}

export function articleParts(body: string) {
  return body.split(/\r?\n\s*\r?\n/u).map((part) => part.trim()).filter(Boolean).map((part) => {
    if (part.startsWith("## ") && !part.includes("\n")) return { type: "heading" as const, text: part.slice(3) };
    const lines = part.split(/\r?\n/u);
    if (lines.every((line) => line.startsWith("- "))) return { type: "list" as const, items: lines.map((line) => line.slice(2)) };
    return { type: "paragraph" as const, text: part };
  });
}
