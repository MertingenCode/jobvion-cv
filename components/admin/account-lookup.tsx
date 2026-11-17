"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { findAccount, type AccountState } from "@/lib/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AccountLookup({ canManagePromos = false }: { canManagePromos?: boolean }) {
  const locale = useLocale();
  const t = useTranslations("admin");
  const [state, action, pending] = useActionState(findAccount, {} as AccountState);
  const release = useTranslations("release");
  const number = new Intl.NumberFormat(locale);
  const account = state.account;
  return <>
    <form action={action} className="studio-form">
      <div className="field">
        <label htmlFor="lookup-email">{t("email")}</label>
        <Input id="lookup-email" name="email" type="email" autoComplete="off" maxLength={254} required />
      </div>
      <Button type="submit" disabled={pending}>{t("lookup")}</Button>
    </form>
    {state.notice && <p role="status">{t(state.notice)}</p>}
    {account && <dl className="studio-list">
      <div><dt>{t("account")}</dt><dd>{account.id}</dd></div>
      <div><dt>{t("created")}</dt><dd>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(account.createdAt))} UTC</dd></div>
      <div><dt>{t("free")}</dt><dd>{account.free === null ? "—" : number.format(account.free)}</dd></div>
      <div><dt>{t("paid")}</dt><dd>{account.paid === null ? "—" : number.format(account.paid)}</dd></div>
      <div><dt>{t("purchases")}</dt><dd>{number.format(account.purchases)}</dd></div>
    </dl>}
    {account && canManagePromos && <Link className="blog-link" href={"/" + locale + "/admin/promotion?user=" + account.id}>{release("promotion")}</Link>}
  </>;
}
