export const locales = ["en", "tr", "de", "fr", "es", "it", "pt", "nl"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
export const localeCookie = "jobvion-locale";
export const localeNames: Record<Locale, string> = {
  en: "English", tr: "Türkçe", de: "Deutsch", fr: "Français",
  es: "Español", it: "Italiano", pt: "Português", nl: "Nederlands",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.some((locale) => locale === value);
}

export function negotiateLocale(saved: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(saved)) return saved;
  const candidates = (acceptLanguage ?? "").slice(0, 2048).split(",").map((entry) => {
    const [tag, ...parameters] = entry.trim().toLowerCase().split(";");
    const quality = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith("q="));
    return { locale: tag.split("-")[0], weight: quality === undefined ? 1 : Number(quality.slice(2)) };
  });
  candidates.sort((left, right) => right.weight - left.weight);
  return candidates.find(({ locale, weight }) => isLocale(locale) && weight > 0 && weight <= 1)?.locale as Locale | undefined ?? defaultLocale;
}
