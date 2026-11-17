import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { cvSession, readCvWorkspace } from "@/lib/cv/data";
import { routeLocale } from "@/lib/admin/ui";
import { initialProfile } from "@/lib/cv/model";
import { CvEditor } from "@/components/cv/editor";

export const metadata = { robots: { index: false, follow: false } };

export default async function CvWorkspace({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ mode?: string }> }) {
  const locale = await routeLocale(params);
  const session = await cvSession();
  if (!session) redirect(`/${locale}/login`);
  const [data, t] = await Promise.all([readCvWorkspace(session), getTranslations({ locale, namespace: "cv" })]);
  const mode = (await searchParams).mode;
  const detached = mode === "new" && Boolean(data && data.revision > 0);
  const openImport = mode === "import";
  return <section className="container cv-workspace">
    <h1>{t("editor")}</h1>
    {data ? <CvEditor key={detached ? "new" : "profile"} {...data} profile={detached ? initialProfile : data.profile} detached={detached} openImport={openImport} locale={locale} owner={session.id} /> : <p role="status">{t("unavailable")}</p>}
  </section>;
}
