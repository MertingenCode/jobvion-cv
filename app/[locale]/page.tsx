import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { buttonVariants } from "@/components/ui/button";
import { CvSample } from "@/components/cv-sample";
import { verifiedUserId } from "@/lib/auth/session";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale });
  return { title: `Jobvion | ${t("copyright")}`, description: t("summary") };
}

export default async function Home({ params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const [t, user] = await Promise.all([getTranslations({ locale }), verifiedUserId()]);
  return (
    <section className="container hero">
      <div className="intro-content">
        <h1>{t("slogan")}</h1>
        <p className="lede">{t("summary")}</p>
        <Link href={`/${locale}/${user ? "app" : "signup"}`} className={buttonVariants()}>
          {t(user ? "app" : "getStarted")}
        </Link>
      </div>
      <CvSample />
    </section>
  );
}
