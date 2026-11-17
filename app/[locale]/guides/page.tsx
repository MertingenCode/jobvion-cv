import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { guides } from "@/lib/content/guides";
import { marketingMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "release" });
  return marketingMetadata(locale, "/guides", t("guides"), t("guidesIntro"));
}

export default async function Guides({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "release" });
  const language = locale === "tr" ? "tr" : "en";
  return <section className="container release-page release-stack">
    <h1>{t("guides")}</h1>
    <p className="lede">{t("guidesIntro")}</p>
    <ul className="release-list" lang={language}>
      {guides.map((guide) => <li key={guide.slug}>
        <Link className="blog-link" href={`/${language}/guides/${guide.slug}`}>{guide[language][0]}</Link>
        <p>{guide[language][1]}</p>
      </li>)}
    </ul>
  </section>;
}
