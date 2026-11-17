"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { enrollAdminMfa, verifyAdminMfa, type MfaState } from "@/lib/admin/mfa";
import type { Locale } from "@/i18n/config";

function Challenge({ locale, factor }: { locale: Locale; factor: string }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(verifyAdminMfa.bind(null, locale, factor), {} as MfaState);
  return <form action={action} className="studio-form">
    <div className="field">
      <label htmlFor="mfa-code">{t("code")}</label>
      <Input id="mfa-code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required maxLength={6} />
    </div>
    {state.error && <p role="alert" className="form-error">{t(state.error)}</p>}
    <Button type="submit" disabled={pending}>{t("verify")}</Button>
  </form>;
}

export function MfaForm({ locale, factor }: { locale: Locale; factor?: string }) {
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(enrollAdminMfa, {} as MfaState);
  const factorId = state.factorId ?? factor;
  return <>
    {state.secret ? <><p>{t("setupHelp")}</p><code className="studio-secret">{state.secret}</code></> :
      factor ? <p>{t("mfaHelp")}</p> : null}
    {state.error && <p className="form-error" role="alert">{t(state.error)}</p>}
    {factorId ? <Challenge locale={locale} factor={factorId} /> : <form action={action} className="studio-form">
      <Button type="submit" disabled={pending}>{t("enroll")}</Button>
    </form>}
  </>;
}
