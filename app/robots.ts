import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { readEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/api/", "/admin", ...locales.flatMap((locale) => [`/${locale}/admin`, `/${locale}/app`])];
  return { rules: [{ userAgent: "*", allow: "/", disallow }], sitemap: readEnv().APP_ORIGIN + "/sitemap.xml" };
}
