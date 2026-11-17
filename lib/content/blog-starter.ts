import type { Locale } from "@/i18n/config";
import type { BlogPost } from "@/lib/blog/schema";
import entries from "./blog-starter.json";

const identifiers = {
  "reuse-one-cv-profile": "31a60144-8acc-4bb8-8a7d-4c171c1e2701",
  "check-keywords-with-evidence": "31a60144-8acc-4bb8-8a7d-4c171c1e2702",
};
export const starterSlugs = Object.keys(identifiers) as (keyof typeof identifiers)[];
const languages: Locale[] = ["tr", "en", "de", "fr", "es", "it", "pt", "nl"];

export function starterPost(locale: Locale, slug: string): BlogPost | null {
  if (!Object.hasOwn(identifiers, slug)) return null;
  const key = slug as keyof typeof identifiers;
  const [title, excerpt, ...paragraphs] = entries[key][locale];
  const group = identifiers[key];
  const id = group.slice(0, -2) + languages.indexOf(locale) + group.at(-1);
  return {
    id, translation_group: group, revision: 1, locale, slug, title, excerpt,
    body: paragraphs.join("\n\n"), author: "Jobvion", category: "", tags: [],
    seo_title: "", seo_description: "", status: "published",
    updated_at: "2026-11-17T00:00:00Z", published_at: null, scheduled_at: null,
  };
}

export function starterPosts(locale: Locale) {
  return starterSlugs.map((slug) => starterPost(locale, slug)!);
}
