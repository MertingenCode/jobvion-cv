import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/access";
import { routeLocale } from "@/lib/admin/ui";
import { AccountLookup } from "@/components/admin/account-lookup";

export default async function Accounts({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await routeLocale(params);
  await requireAdmin(locale, "accounts");
  const t = await getTranslations({ locale, namespace: "admin" });
  return <><h1>{t("users")}</h1><AccountLookup /></>;
}
