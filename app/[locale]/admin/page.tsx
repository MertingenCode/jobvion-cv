import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/access";
import { permitted } from "@/lib/admin/roles";
import { routeLocale } from "@/lib/admin/ui";
import { Report } from "@/components/admin/report";
import { buttonVariants } from "@/components/ui/button";

export default async function Overview({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const locale = await routeLocale(params);
  const session = await requireAdmin(locale);
  const t = await getTranslations({ locale, namespace: "admin" });
  return (
    <>
      <h1>{t("overview")}</h1>
      {permitted(session.role, "reports")
        ? <Report locale={locale} db={session.supabase} section="overview" period={(await searchParams).days} />
        : <Link href={`/${locale}/admin/${session.role === "editor" ? "blog" : "users"}`} className={buttonVariants()}>
          {t(session.role === "editor" ? "blog" : "users")}
        </Link>}
    </>
  );
}
