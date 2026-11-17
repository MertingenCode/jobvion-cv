"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function LocaleError({ reset }: { reset: () => void }) {
  const t = useTranslations();
  return (
    <section className="container workspace">
      <h1>{t("genericError")}</h1>
      <p className="lede">{t("errorText")}</p>
      <Button type="button" onClick={reset}>{t("retry")}</Button>
    </section>
  );
}
