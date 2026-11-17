"use client";

import { Turnstile } from "@/components/auth/turnstile";
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { LoaderCircle } from "lucide-react";
import { emailAuth, type AuthStatus } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";

export function EmailForm({ locale, mode, siteKey, nonce }: { locale: Locale; mode: "login" | "signup"; siteKey?: string; nonce?: string }) {
  const t = useTranslations();
  const [status, action, pending] = useActionState<AuthStatus, FormData>(emailAuth.bind(null, locale, mode), null);
  const [email, setEmail] = useState("");
  const isSignup = mode === "signup";
  return (
    <form action={action} className="email-form" aria-busy={pending}>
      <div className="field">
        <label htmlFor="email">{t("email")}</label>
        <Input id="email" name="email" type="email" autoComplete="email"
          maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="password">{t("password")}</label>
        <Input id="password" name="password" type="password" required
          maxLength={72} minLength={isSignup ? 8 : undefined}
          autoComplete={isSignup ? "new-password" : "current-password"}
          aria-describedby={isSignup ? "password-hint" : undefined} />
        {isSignup && <span id="password-hint" className="form-hint">{t("passwordHint")}</span>}
      </div>
      {siteKey && <Turnstile siteKey={siteKey} nonce={nonce} pending={pending} />}
      {status && <p className={status === "confirm" ? "form-success" : "form-error"}
        role={status === "confirm" ? "status" : "alert"}>{t(status)}</p>}
      <Button type="submit" disabled={pending}>
        {pending && <LoaderCircle className="spinner" size={18} aria-hidden="true" />}
        {t(mode)}
      </Button>
    </form>
  );
}
