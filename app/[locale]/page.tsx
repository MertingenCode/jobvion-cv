import type { Metadata } from "next";
import { headers } from "next/headers";
import { marketingMetadata } from "@/lib/seo";
import { readEnv } from "@/lib/env";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { buttonVariants } from "@/components/ui/button";
import { CvSample } from "@/components/cv-sample";
import { RefractWater } from "@/components/layout/refract-water";
import { verifiedUserId } from "@/lib/auth/session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale });
  return marketingMetadata(locale, "", t("slogan"), t("summary"));
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, user] = await Promise.all([getTranslations({ locale }), verifiedUserId()]);
  const nonce = (await headers()).get("x-jobvion-nonce") ?? undefined;
  const structured = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Jobvion", url: readEnv().APP_ORIGIN + "/" + locale, inLanguage: locale,
    description: t("summary"), applicationCategory: "BusinessApplication", operatingSystem: "Web",
  };
  return (
    <section className="hero" aria-labelledby="home-title">
      <script type="application/ld+json" nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structured).replaceAll("<", "\\u003c") }} />
      <RefractWater />
      <div className="container refract-grid">
        <div className="intro-content">
          <h1 id="home-title">{t("slogan")}</h1>
          <p className="lede">{t("summary")}</p>
          <Link href={`/${locale}/${user ? "app" : "signup"}`} className={buttonVariants()}>
            {t(user ? "app" : "getStarted")}
          </Link>
        </div>
        <CvSample />
      </div>
    </section>
  );
}
