import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { templates } from "@/lib/cv/templates";
import { marketingMetadata } from "@/lib/seo";
import { cvFontFace, cvFontPath, cvStyles } from "@/lib/cv/styles";
import { sampleProfile } from "@/lib/cv/sample";
import { renderCv } from "@/lib/cv/document";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "release" });
  return marketingMetadata(locale, "/templates", t("templates"), t("gallery"));
}

export default async function Gallery({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "release" });
  const cv = await getTranslations({ locale, namespace: "cv" });
  const profile = sampleProfile(locale);
  return <section className="container release-page release-stack">
    <h1>{t("templates")}</h1>
    <style>{cvFontFace(cvFontPath) + cvStyles}</style>
    <ul className="release-grid gallery-grid">
      {templates.map((template) => <li key={template.id}>
        <Link href={`/${locale}/templates/${template.id}`} prefetch={false}>
          <div className="gallery-preview" aria-hidden="true">
            <div className="gallery-miniature" dangerouslySetInnerHTML={{ __html: renderCv(profile,
              { template: template.id, language: locale, paper: "A4", photo: false }, template) }} />
          </div>
          <h2>{template.name}</h2>
          <span>{cv(template.tier)}{template.supports_photo && ` · ${cv("photos")}`}</span>
        </Link>
      </li>)}
    </ul>
  </section>;
}
