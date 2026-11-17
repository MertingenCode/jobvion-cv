import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "@/i18n/config";
import blog from "@/messages/blog.json";
import cv from "@/messages/cv.json";
import authFlow from "@/messages/auth-flow.json";
import release from "@/messages/release.json";
import adminEn from "@/messages/admin/en.json";
import adminTr from "@/messages/admin/tr.json";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : defaultLocale;
  const base = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages: { ...base, blog: blog[locale], authFlow: authFlow[locale], release: release[locale], cv: cv[locale], admin: locale === "tr" ? adminTr : adminEn } };
});
