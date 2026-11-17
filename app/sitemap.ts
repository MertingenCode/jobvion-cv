import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { publishedLinks } from "@/lib/blog/public";
import { readEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = readEnv().APP_ORIGIN;
  const entries: MetadataRoute.Sitemap = locales.map((locale) => ({ url: origin + "/" + locale }));
  const links = await publishedLinks();
  for (const locale of new Set(links.map((item) => item.locale))) {
    entries.push({ url: origin + `/${locale}/blog` });
  }
  for (const { locale, slug, updated_at } of links) {
    entries.push({ url: origin + `/${locale}/blog/${slug}`, lastModified: updated_at });
  }
  return entries;
}
