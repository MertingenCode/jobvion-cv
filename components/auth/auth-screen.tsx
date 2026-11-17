import Link from "next/link";
import { useTranslations } from "next-intl";
import { OtpForm } from "@/components/auth/otp-form";
import { Button } from "@/components/ui/button";
import { socialAuth } from "@/lib/auth/actions";
import type { Locale } from "@/i18n/config";

function ProviderIcon({ provider }: { provider: "google" | "apple" }) {
  return <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" focusable="false">
    {provider === "google" ? <>
      <path className="google-blue" d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.5a4.7 4.7 0 0 1-2 3v2.5h3.3a10 10 0 0 0 3-7.4Z" />
      <path className="google-green" d="M12 22c2.7 0 5-.9 6.8-2.4l-3.3-2.5c-.9.6-2.1.9-3.5.9-2.7 0-5-1.8-5.8-4.2H2.8v2.6A10.1 10.1 0 0 0 12 22Z" />
      <path className="google-yellow" d="M6.2 13.8a6 6 0 0 1 0-3.6V7.6H2.8a10 10 0 0 0 0 8.8l3.4-2.6Z" />
      <path className="google-red" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.8A9.6 9.6 0 0 0 12 2a10.1 10.1 0 0 0-9.2 5.6l3.4 2.6A6 6 0 0 1 12 6Z" />
    </> : <path fill="currentColor" d="M17.8 12.5c0-2 1.6-3 1.7-3.1-.9-1.4-2.4-1.7-2.9-1.7-1.3-.2-2.6.8-3.2.8-.7 0-1.8-.8-2.9-.8a4.3 4.3 0 0 0-3.7 2.2c-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.7 2.3 1.1-.1 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7s1.9-1.1 2.6-2.2c.8-1.3 1.2-2.5 1.2-2.6-.1 0-2.4-.9-2.4-3.9ZM15.8 6.4c.6-.8 1.1-1.9 1-3-.9.1-2 .6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3Z" transform="translate(-1 0)" />}
  </svg>;
}

export function AuthScreen({ locale, mode, status, siteKey, nonce }: { locale: Locale; mode: "login" | "signup"; status?: string; siteKey?: string; nonce?: string }) {
  const t = useTranslations();
  const auth = useTranslations("authFlow");
  const opposite = mode === "login" ? "signup" : "login";
  const feedback = status === "failed" || status === "unavailable" || status === "limited" ? status : null;
  return <section className="container identity-layout">
    <div className="auth-main identity-panel">
      <h1>{t(mode)}</h1>
      <p className="lede">{auth(mode === "login" ? "loginIntro" : "signupIntro")}</p>
      {feedback && <p className="form-error" role="alert">{t(feedback)}</p>}
      <div className="auth-providers">
        {(["google", "apple"] as const).map((provider) => <form key={provider} action={socialAuth.bind(null, locale, provider)}>
          <Button type="submit" variant="outline" className="provider-button">
            <ProviderIcon provider={provider} />{auth(provider)}
          </Button>
        </form>)}
      </div>
      <p className="divider"><span>{auth("separator")}</span></p>
      <OtpForm locale={locale} mode={mode} siteKey={siteKey} nonce={nonce} />
      <p className="auth-switch">
        {t(mode === "login" ? "needAccount" : "haveAccount")}{" "}
        <Link href={`/${locale}/${opposite}`}>{t(opposite)}</Link>
      </p>
    </div>
  </section>;
}
