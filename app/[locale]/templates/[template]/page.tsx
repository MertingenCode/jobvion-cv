import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CvPaper, CvPaperStyles } from "@/components/cv/paper";
import { buttonVariants } from "@/components/ui/button";
import { isLocale } from "@/i18n/config";
import { getTemplate } from "@/lib/cv/templates";
import { marketingMetadata } from "@/lib/seo";
import { sampleProfile } from "@/lib/cv/sample";
import { verifiedUserId } from "@/lib/auth/session";

type Props = { params: Promise<{ locale: string; template: string }> };

async function getPage(params: Props["params"]) {
  const { locale, template: slug } = await params;
  const template = getTemplate(slug);
  if (!isLocale(locale) || !template) notFound();
  const t = await getTranslations({ locale, namespace: "release" });
  const cv = await getTranslations({ locale, namespace: "cv" });
  return { locale, template, t, cv };
}

export async function generateMetadata({ params }: Props) {
  const { locale, template, t, cv } = await getPage(params);
  return marketingMetadata(locale, "/templates/" + template.id, template.name + " · " + t("templates"),
    template.name + " · " + t("gallery") + " · " + cv(template.tier));
}

export default async function TemplatePreview({ params }: Props) {
  const { locale, template, t, cv } = await getPage(params);
  const user = await verifiedUserId();
  return <section className="container release-page release-stack">
    <Link className="blog-link" href={`/${locale}/templates`}>{t("templates")}</Link>
    <h1>{template.name}</h1>
    <p>{cv(template.tier)}{template.supports_photo && ` · ${cv("photos")}`}</p>
    <Link className={buttonVariants()} href={`/${locale}/${user ? "app/cv" : "signup"}`}>{cv("editor")}</Link>
    <div className="gallery-detail" aria-hidden="true"><CvPaperStyles /><CvPaper profile={sampleProfile(locale)} template={template}
      choice={{ template: template.id, language: locale, paper: "A4", photo: false }} /></div>
  </section>;
}
