import Link from "next/link";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { Theme } from "@/lib/security/preferences";
import { Preferences } from "@/components/layout/preferences";
import { buttonVariants } from "@/components/ui/button";

export function Shell({ locale, theme, signedIn, children }: {
  locale: Locale;
  theme: Theme;
  signedIn: boolean;
  children: ReactNode;
}) {
  const t = useTranslations();
  return (
    <>
      <a href="#content" className="skip-link">{t("skip")}</a>
      <header className="site-header">
        <div className="container header-row">
          <Link href={`/${locale}`} className="brand">
            <span className="brand-mark"><FileText size={18} aria-hidden="true" /></span>
            Jobvion
          </Link>
          <div className="header-controls">
            <Preferences locale={locale} theme={theme} labels={{
              language: t("language"), theme: t("theme"), system: t("system"), dark: t("dark"), light: t("light"),
              changeTheme: t("changeTheme"), switchLanguage: t("switchLanguage"),
            }} />
            <Link className={buttonVariants({ variant: "quiet" })} href={`/${locale}/${signedIn ? "app" : "login"}`}>
              {t(signedIn ? "app" : "login")}
            </Link>
          </div>
        </div>
      </header>
      <main id="content" tabIndex={-1}>{children}</main>
      <footer className="site-footer">
        <div className="container footer-row">
          <span>Jobvion</span>
          <span>{t("copyright")}</span>
        </div>
      </footer>
    </>
  );
}
