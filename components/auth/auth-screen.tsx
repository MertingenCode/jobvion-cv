import Link from "next/link";
import { useTranslations } from "next-intl";
import { EmailForm } from "@/components/auth/email-form";
import { Button } from "@/components/ui/button";
import { CvSample } from "@/components/cv-sample";
import { googleAuth } from "@/lib/auth/actions";
import type { Locale } from "@/i18n/config";

export function AuthScreen({ locale, mode, status, siteKey, nonce }: { locale: Locale; mode: "login" | "signup"; status?: string; siteKey?: string; nonce?: string }) {
  const t = useTranslations();
  const opposite = mode === "login" ? "signup" : "login";
  const feedback = status === "failed" || status === "unavailable" || status === "limited" ? status : null;
  return (
    <div className="container auth-layout">
      <div className="auth-main">
        <h1>{t(mode)}</h1>
        <p className="lede">{t(mode === "login" ? "loginText" : "signupText")}</p>
        {feedback && <p className="form-error" role="alert">{t(feedback)}</p>}
        <form action={googleAuth.bind(null, locale)}>
          <Button type="submit" variant="outline" className="google-button">{t("google")}</Button>
        </form>
        <p className="divider"><span>{t("separator")}</span></p>
        <EmailForm locale={locale} mode={mode} siteKey={siteKey} nonce={nonce} />
        <p className="auth-switch">
          {t(mode === "login" ? "needAccount" : "haveAccount")}{" "}
          <Link href={`/${locale}/${opposite}`}>{t(opposite)}</Link>
        </p>
      </div>
      <CvSample compact />
    </div>
  );
}
