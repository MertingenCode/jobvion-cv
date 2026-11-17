import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { adminSession } from "@/lib/admin/access";
import { routeLocale } from "@/lib/admin/ui";
import { MfaForm } from "@/components/admin/mfa-form";

export default async function AdminMfa({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await routeLocale(params);
  const session = await adminSession();
  if (!session) notFound();
  if (session.mfa) redirect(`/${locale}/admin`);
  const t = await getTranslations({ locale, namespace: "admin" });
  const { data, error } = await session.supabase.auth.mfa.listFactors();
  return <><h1>{t("mfa")}</h1>
    {error ? <p>{t("unavailable")}</p> : <MfaForm locale={locale} factor={data.totp[0]?.id} />}
  </>;
}
