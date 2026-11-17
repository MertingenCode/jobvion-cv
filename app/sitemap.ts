import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { publishedLinks } from "@/lib/blog/public";
import { readEnv } from "@/lib/env";

import { templates } from "@/lib/cv/templates";
import { guides } from "@/lib/content/guide";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = readEnv().APP_ORIGIN;
  const published = ["", "/templates", "/guides", ...templates.map(({ id }) => "/templates/" + id)];
  const entries: MetadataRoute.Sitemap = published.flatMap((path) =>
    locales.map((locale) => ({ url: origin + "/" + locale + path })));
  for (const locale of locales) {
    for (const { slug } of guides) entries.push({ url: origin + "/" + locale + "/guides/" + slug });
  }
  const links = await publishedLinks();
  for (const locale of new Set(links.map((item) => item.locale))) {
    entries.push({ url: origin + `/${locale}/blog` });
  }
  for (const { locale, slug, updated_at } of links) {
    entries.push({ url: origin + `/${locale}/blog/${slug}`, lastModified: updated_at });
  }
  return entries;
}
