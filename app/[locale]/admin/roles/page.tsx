import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/access";
import { routeLocale } from "@/lib/admin/ui";
import { changeRole } from "@/lib/admin/actions";
import { Notice } from "@/components/admin/common";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AccountLookup } from "@/components/admin/account-lookup";

export default async function Roles({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<{ notice?: string }>;
}) {
  const locale = await routeLocale(params);
  await requireAdmin(locale, "roles");
  const t = await getTranslations({ locale, namespace: "admin" });
  return <>
    <h1>{t("roles")}</h1>
    <AccountLookup />
    <Notice value={(await searchParams).notice} />
    <form action={changeRole.bind(null, locale)} className="studio-form">
      <div className="studio-columns">
        <div className="field"><label htmlFor="role-account">{t("account")}</label>
          <Input id="role-account" name="account" maxLength={36} required /></div>
        <div className="field"><label htmlFor="role-select">{t("role")}</label>
          <select className="input" id="role-select" name="role" defaultValue="" required>
            <option value="" disabled>{t("role")}</option>
            {(["admin", "editor", "support", "analyst", "none"] as const).map((role) =>
              <option key={role} value={role}>{t(role)}</option>)}
          </select></div>
      </div>
      <label className="studio-confirm"><input type="checkbox" name="confirm" required />{t("confirm")}</label>
      <Button type="submit">{t("updateRole")}</Button>
    </form>
  </>;
}
