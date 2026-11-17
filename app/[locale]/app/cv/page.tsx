import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cvSession, readCvWorkspace } from "@/lib/cv/data";
import { routeLocale } from "@/lib/admin/ui";
import { CvEditor } from "@/components/cv/editor";

export const metadata = { robots: { index: false, follow: false } };

export default async function CvWorkspace({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await routeLocale(params);
  const session = await cvSession();
  if (!session) redirect(`/${locale}/login`);
  const [data, t] = await Promise.all([readCvWorkspace(session), getTranslations({ locale, namespace: "cv" })]);
  return <section className="container cv-workspace">
    <h1>{t("editor")}</h1>
    {data ? <CvEditor {...data} locale={locale} owner={session.id} /> : <p role="status">{t("unavailable")}</p>}
  </section>;
}
