import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";

export const notices = ["saved", "failed", "conflict", "invalid", "denied", "limited"] as const;

export async function routeLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  return locale;
}

export function utcLabel(locale: string, value: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(value));
}

export function pageNumber(value: unknown) {
  return typeof value === "string" && /^[1-9]\d{0,2}$/.test(value) ? Number(value) : 1;
}
