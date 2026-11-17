import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import { Preferences } from "@/components/layout/preferences";
import { buttonVariants } from "@/components/ui/button";

function Brand({ locale }: { locale: Locale }) {
  return <Link href={`/${locale}`} className="brand">
    <Image src="/jobvion-mark.svg" alt="" width={34} height={34} priority />
    <span>Jobvion</span>
  </Link>;
}

export function Shell({ locale, signedIn, children }: { locale: Locale; signedIn: boolean; children: ReactNode }) {
  const t = useTranslations();
  const blog = useTranslations("blog");
  const release = useTranslations("release");
  const landing = useTranslations("landing");
  const home = "/" + locale;
  return <>
    <a href="#content" className="skip-link">{t("skip")}</a>
    <header className="site-header">
      <div className="container header-row">
        <Brand locale={locale} />
        <nav className="site-nav">
          <Link href={home + "#tools"}>{landing("tools")}</Link>
          <Link href={home + "#cv-check"}>{landing("score")}</Link>
          <Link href={home + "/templates"}>{release("templates")}</Link>
          <Link href={home + "#pricing"}>{release("pricing")}</Link>
          <Link href={home + "/guides"}>{release("guides")}</Link>
          <Link href={home + "/blog"}>{blog("title")}</Link>
        </nav>
        <div className="header-controls">
          <Preferences locale={locale} labels={{
            language: t("language"), dark: t("dark"), light: t("light"), switchLanguage: t("switchLanguage"),
          }} />
          <Link className={buttonVariants({ variant: "outline" })} href={home + (signedIn ? "/app" : "/login")}>
            {t(signedIn ? "app" : "login")}
          </Link>
        </div>
      </div>
    </header>
    <main id="content" tabIndex={-1}>{children}</main>
    <footer className="site-footer">
      <div className="container footer-row">
        <Brand locale={locale} />
        <nav className="release-nav">
          <Link href={home + "#pricing"}>{release("pricing")}</Link>
          <Link href={home + "/templates"}>{release("templates")}</Link>
          <Link href={home + "/guides"}>{release("guides")}</Link>
          <Link href={home + "/blog"}>{blog("title")}</Link>
          <Link href={home + "/legal/privacy"}>{release("legal")}</Link>
          <Link href={home + "/legal/refunds"}>{release("refundPolicy")}</Link>
        </nav>
        <span>{t("copyright")}</span>
      </div>
    </footer>
  </>;
}
