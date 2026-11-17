import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { guides, localizedGuide } from "@/lib/content/guide";
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

  return <section className="container release-page release-stack">
    <h1>{t("guides")}</h1>
    <p className="lede">{t("guidesIntro")}</p>
    <ul className="release-list">
      {guides.map((guide) => {
        const [title, summary] = localizedGuide(locale, guide.slug)!;
        return <li key={guide.slug}>
        <Link className="blog-link" href={`/${locale}/guides/${guide.slug}`}>{title}</Link>
        <p>{summary}</p>
      </li>; })}
    </ul>
  </section>;
}
