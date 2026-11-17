import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { locales, negotiateLocale } from "@/i18n/config";

describe("root locale negotiation", () => {
  it("maps regional tags to supported locales", () => {
    expect(negotiateLocale(undefined, "de-DE,de;q=0.9,en;q=0.8")).toBe("de");
    expect(negotiateLocale(undefined, "pt-BR,fr;q=0.5")).toBe("pt");
  });

  it("uses the preference cookie ahead of the browser language", () => {
    expect(negotiateLocale("tr", "de-DE")).toBe("tr");
    expect(negotiateLocale("ja", "de-DE")).toBe("de");
  });

  it("honors quality and falls back to English", () => {
    expect(negotiateLocale(undefined, "tr;q=0.5,nl;q=0.9,de;q=0")).toBe("nl");
    expect(negotiateLocale(undefined, "ja-JP,tr;q=NaN,fr;q=0")).toBe("en");
  });

  it("includes every message in all eight locales", async () => {
    const dictionaries = await Promise.all(locales.map(async (locale) =>
      JSON.parse(await readFile(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")) as Record<string, string>,
    ));
    const keys = Object.keys(dictionaries[0]).sort();
    for (const dictionary of dictionaries) {
      expect(Object.keys(dictionary).sort()).toEqual(keys);
      expect(Object.values(dictionary).every((value) => value.trim().length > 0)).toBe(true);
    }
  });
});
