import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowDown, ArrowRight, Check, FilePlus2, FilePenLine, FileText, ScanSearch, X } from "lucide-react";
import { isLocale } from "@/i18n/config";
import { buttonVariants } from "@/components/ui/button";
import { CvSample } from "@/components/cv-sample";
import { CvScore, PublicCvCheck } from "@/components/cv/score";
import { Pricing } from "@/components/billing/pricing";
import { verifiedUserId } from "@/lib/auth/session";
import { entryPath, type Destination } from "@/lib/auth/destination";
import { marketingMetadata } from "@/lib/seo";
import { readEnv } from "@/lib/env";

import { scoreProfile } from "@/lib/cv/check";
import { sampleProfile } from "@/lib/cv/sample";
import { reportMatches } from "@/lib/application/model";
import { getTemplate } from "@/lib/cv/templates";
import { renderCv } from "@/lib/cv/document";
import { cvFontFace, cvFontPath, cvStyles } from "@/lib/cv/styles";

type Props = { params: Promise<{ locale: string }> };

const actions = [
  { key: "new", destination: "cv", Icon: FilePlus2 },
  { key: "import", destination: "import", Icon: FilePenLine },
  { key: "tailor", destination: "tailor", Icon: ScanSearch },
  { key: "letter", destination: "letter", Icon: FileText },
] as const satisfies { key: string; destination: Destination; Icon: typeof FileText }[];

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "landing" });
  return marketingMetadata(locale, "", t("hero"), t("intro"));
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, release, cv, user] = await Promise.all([
    getTranslations({ locale, namespace: "landing" }),
    getTranslations({ locale, namespace: "release" }),
    getTranslations({ locale, namespace: "cv" }),
    verifiedUserId(),
  ]);
  const start = (destination: Destination) => entryPath(locale, Boolean(user), destination);
  const nonce = (await headers()).get("x-jobvion-nonce") ?? undefined;
  const structured = {
    "@context": "https://schema.org", "@type": "WebApplication", name: "Jobvion",
    url: readEnv().APP_ORIGIN + "/" + locale, inLanguage: locale, description: t("intro"),
    applicationCategory: "BusinessApplication", operatingSystem: "Web",
  };
  const profile = sampleProfile(locale);
  const sample = [profile.name, profile.title, profile.email, cv("experience"), ...profile.experience.map((entry) =>
    [entry.title, entry.organization, entry.start.slice(0, 4), entry.detail].join(" / ")), cv("skills"), profile.skills.join(", ")].join("\n");
  const essential = getTemplate("essential")!;
  const checks = scoreProfile(profile, essential, false);
  const matches = reportMatches({ position: profile.title, company: "", required: ["Figma", "WCAG", "SQL"], preferred: [] }, profile);
  const previewTemplates = [essential, getTemplate("atlas")!, getTemplate("halo")!];


  return <div className="landing-page">
    <script type="application/ld+json" nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replaceAll("<", "\\u003c") }} />
    <section className="landing-hero" aria-labelledby="home-title">
      <div className="container landing-hero-grid">
        <div className="landing-intro">
          <h1 id="home-title">{t("hero")}</h1>
          <p>{t("intro")}</p>
          <div className="landing-actions">
            <Link href={start("cv")} className={buttonVariants()}>{t("start")} <ArrowRight size={18} aria-hidden="true" /></Link>
            <a href="#cv-check" className={buttonVariants({ variant: "outline" })}>{t("runCheck")} <ArrowDown size={17} aria-hidden="true" /></a>
          </div>
        </div>
        <div className="landing-example">
          <CvSample />
          <div className="landing-score-card">
            <div className="proof-label">{t("example")}</div>
            <CvScore result={checks} />
          </div>
        </div>
      </div>
    </section>

    <section id="tools" className="container landing-section">
      <div className="section-heading"><h2>{t("features")}</h2><p>{t("why")}</p></div>
      <ul className="workflow-grid">
        {actions.map(({ key, destination, Icon }) => <li key={key}>
          <Link href={start(destination)} className="workflow-action">

            <h3><Icon size={22} strokeWidth={1.8} aria-hidden="true" />{t(key + "Title")}</h3>
            <p>{t(key + "Body")}</p>
            <ArrowRight size={19} aria-hidden="true" className="workflow-arrow" />
          </Link>
        </li>)}
      </ul>
    </section>

    <section id="cv-check" className="landing-contrast">
      <div className="container landing-section">
        <div className="section-heading"><h2>{t("scoreHeading")}</h2><p>{t("scoreIntro")}</p></div>
        <PublicCvCheck locale={locale} example={sample} />
      </div>
    </section>

    <section className="container landing-section proof-grid">
      <div className="section-heading">
        <h2>{t("proof")}</h2><p>{t("proofBody")}</p>
        <a className={buttonVariants({ variant: "outline" })} href="/examples/jobvion-ats-cv.pdf" download>{t("pdfSample")}</a>
      </div>
      <div className="proof-panel">
        <h3>{t("jobExample")}</h3>
        <ul>{matches.map(({ term, matched }) => <li key={term}>
          {matched ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
          <strong>{term}</strong><span>{t(matched ? "matched" : "notMatched")}</span>
        </li>)}</ul>
        <Link href={start("tailor")} className="blog-link">{t("tailorTitle")}</Link>
      </div>
    </section>

    <section className="landing-contrast" id="templates">
      <div className="container landing-section">
        <div className="section-heading"><h2>{t("templatesHeading")}</h2><p>{t("templatesIntro")}</p></div>
        <style>{cvFontFace(cvFontPath) + cvStyles}</style>
        <ul className="landing-templates">
          {previewTemplates.map((template) => <li key={template.id}>
            <Link href={`/${locale}/templates/${template.id}`} prefetch={false}>
              <div className="landing-template-sheet" aria-hidden="true">
                <div dangerouslySetInnerHTML={{ __html: renderCv(profile, { template: template.id, language: locale, paper: "A4", photo: false }, template) }} />
              </div>
              <strong>{template.name}</strong>
            </Link>
          </li>)}
        </ul>
        <Link href={`/${locale}/templates`} className={buttonVariants({ variant: "outline" })}>{release("gallery")}</Link>
      </div>
    </section>

    <Pricing locale={locale} startHref={start("cv")} />

    <section className="landing-contrast" id="faq">
      <div className="container landing-section faq-grid">
        <div className="section-heading"><h2>{t("faq")}</h2></div>
        <div>{(["A", "B", "C"] as const).map((item) => <details key={item}>
          <summary>{t("faq" + item)}</summary><p>{t("answer" + item)}</p>
        </details>)}</div>
      </div>
    </section>
  </div>;
}
