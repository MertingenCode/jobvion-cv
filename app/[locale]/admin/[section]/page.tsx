import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/access";
import { routeLocale } from "@/lib/admin/ui";
import { Report, reportSections } from "@/components/admin/report";

export default async function AdminReport({ params, searchParams }: {
  params: Promise<{ locale: string; section: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const locale = await routeLocale(params);
  const { section } = await params;
  const report = reportSections.find((item) => item === section);
  if (!report) notFound();
  const { supabase } = await requireAdmin(locale, "reports");
  const t = await getTranslations({ locale, namespace: "admin" });
  return <><h1>{t(report)}</h1><Report locale={locale} db={supabase} section={report} period={(await searchParams).days} /></>;
}
