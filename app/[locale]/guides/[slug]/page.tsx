import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { guides } from "@/lib/content/guides";
import { marketingMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string; slug: string }> };

async function article(params: Props["params"]) {
  const { locale, slug } = await params;
  const guide = guides.find((item) => item.slug === slug);
  if (!isLocale(locale) || !guide) notFound();
  if (locale !== "en" && locale !== "tr") permanentRedirect("/en/guides/" + slug);
  return { locale, slug, text: guide[locale] };
}

export async function generateMetadata({ params }: Props) {
  const { locale, slug, text } = await article(params);
  return marketingMetadata(locale, "/guides/" + slug, text[0], text[1], ["en", "tr"]);
}

export default async function Guide({ params }: Props) {
  const { locale, text: [title, description, ...paragraphs] } = await article(params);
  const t = await getTranslations({ locale, namespace: "release" });
  return <article className="container release-page release-stack guide-article">
    <Link className="blog-link" href={`/${locale}/guides`}>{t("guides")}</Link>
    <h1>{title}</h1>
    <p className="lede">{description}</p>
    {paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
  </article>;
}
