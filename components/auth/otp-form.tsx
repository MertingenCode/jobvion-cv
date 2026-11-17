"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, LoaderCircle, Mail, Smartphone } from "lucide-react";
import { Turnstile } from "@/components/auth/turnstile";
import { otpAuth, type AuthStatus } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";

type FormProps = { locale: Locale; mode: "login" | "signup"; siteKey?: string; nonce?: string };
type Channel = "email" | "sms";

function Feedback({ status }: { status: AuthStatus }) {
  const auth = useTranslations("authFlow");
  const common = useTranslations();
  if (!status || status === "sent") return null;
  return <p className="form-error" role="alert">
    {status === "challenge" || status === "codeInvalid" ? auth(status) : common(status)}
  </p>;
}

function ConfirmCode({ locale, mode, channel, contact, back }: Pick<FormProps, "locale" | "mode"> & {
  channel: Channel; contact: string; back: () => void;
}) {
  const t = useTranslations("authFlow");
  const code = useRef<HTMLInputElement>(null);
  const [status, action, pending] = useActionState<AuthStatus, FormData>(otpAuth.bind(null, locale, mode, channel), null);
  useEffect(() => { code.current?.focus(); }, []);

  return <form action={action} className="email-form" aria-busy={pending}>
    <input type="hidden" name="operation" value="verify" />
    <input type="hidden" name="contact" value={contact} />
    <p className="form-hint" role="status">{t(channel === "email" ? "emailSent" : "smsSent")}</p>
    <div className="field">
      <label htmlFor="otp">{t("code")}</label>
      <Input id="otp" name="code" type="text" inputMode="numeric" autoComplete="one-time-code"
        pattern="[0-9]{6}" maxLength={6} required ref={code} readOnly={pending} />
    </div>
    <Feedback status={status} />
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle className="spinner" size={17} aria-hidden="true" />}{t("verify")}<ArrowRight size={17} aria-hidden="true" />
    </Button>
    <Button type="button" variant="quiet" className="otp-back" disabled={pending} onClick={back}>
      <ArrowLeft size={16} aria-hidden="true" />{t("changeContact")}
    </Button>
  </form>;
}

function CodeForm({ locale, mode, siteKey, nonce, channel }: FormProps & { channel: Channel }) {
  const auth = useTranslations("authFlow");
  const common = useTranslations();
  const [status, action, pending] = useActionState<AuthStatus, FormData>(otpAuth.bind(null, locale, mode, channel), null);
  const [contact, setContact] = useState("");
  const [editing, setEditing] = useState(false);
  if (status === "sent" && !editing && !pending) {
    return <ConfirmCode locale={locale} mode={mode} channel={channel} contact={contact} back={() => setEditing(true)} />;
  }

  return <form action={action} className="email-form otp-fields" aria-busy={pending} onSubmit={() => setEditing(false)}>
    <input type="hidden" name="operation" value="send" />
    <div className="field">
      <label htmlFor="contact">{channel === "email" ? common("email") : auth("phone")}</label>
      <Input id="contact" name="contact" type={channel === "email" ? "email" : "tel"} autoComplete={channel === "email" ? "email" : "tel"}
        placeholder={channel === "email" ? "name@example.com" : "+90 5XX XXX XX XX"}
        maxLength={channel === "email" ? 254 : 32} required readOnly={pending} value={contact} onChange={(event) => setContact(event.target.value)} />
    </div>
    {siteKey && <Turnstile siteKey={siteKey} nonce={nonce} pending={pending} />}
    <Feedback status={status} />
    <Button type="submit" disabled={pending}>
      {pending && <LoaderCircle className="spinner" size={17} aria-hidden="true" />}{auth("send")}<ArrowRight size={17} aria-hidden="true" />
    </Button>
  </form>;
}

export function OtpForm(props: FormProps) {
  const t = useTranslations("authFlow");
  const [channel, setChannel] = useState<Channel>("email");
  return <div className="auth-methods">
    <div className="auth-segment" role="group" aria-label={t("method")}>
      <button type="button" aria-pressed={channel === "email"} onClick={() => setChannel("email")}><Mail size={16} aria-hidden="true" />{t("emailMethod")}</button>
      <button type="button" aria-pressed={channel === "sms"} onClick={() => setChannel("sms")}><Smartphone size={16} aria-hidden="true" />{t("smsMethod")}</button>
    </div>
    <CodeForm key={channel} channel={channel} {...props} />
  </div>;
}
