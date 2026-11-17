import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { Promotion } from "@/components/admin/promotion";
import { requireAdmin } from "@/lib/admin/access";
import { routeLocale } from "@/lib/admin/ui";

export default async function PromotionPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ user?: string }> }) {
  const locale = await routeLocale(params);
  await requireAdmin(locale, "audit");
  const user = z.uuid().safeParse((await searchParams).user).data;
  const t = await getTranslations({ locale, namespace: "release" });
  return <section className="release-stack">
    <h1>{t("promotion")}</h1>
    <p>{locale === "tr" ? "Promosyon kredileri 30 gün boyunca kullanılabilir." : "Promotional credits expire after 30 days."}</p>
    <Promotion locale={locale} user={user} />
  </section>;
}
