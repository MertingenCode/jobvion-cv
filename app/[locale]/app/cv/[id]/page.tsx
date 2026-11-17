import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { cvSession, fetchSavedCv } from "@/lib/cv/data";
import { routeLocale } from "@/lib/admin/ui";
import { SavedDocument } from "@/components/cv/saved";

export const metadata = { robots: { index: false, follow: false } };

export default async function SavedCvPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await routeLocale(params);
  const session = await cvSession();
  if (!session) redirect(`/${locale}/login`);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const item = await fetchSavedCv(session, id);
  if (!item) notFound();
  const [t, { data: allowed }, portrait] = await Promise.all([
    getTranslations({ locale, namespace: "cv" }),
    session.db.rpc("can_use_cv_template", { p_template: item.template, p_photo: item.photo_enabled }),
    item.photo_enabled ? session.db.from("cv_profile_photos").select("updated_at").eq("user_id", session.id).maybeSingle() : null,
  ]);
  const photoVersion = portrait?.data?.updated_at;
  const photo = typeof photoVersion === "string" ? "/api/cv/photo?v=" + encodeURIComponent(photoVersion) : undefined;

  return <section className="container cv-workspace">
    <Link className="blog-link" href={`/${locale}/app/cv`}>{t("editor")}</Link>
    <h1>{item.profile_snapshot.name || t("myDocuments")}</h1>
    <SavedDocument item={item} locale={locale} locked={allowed !== true} photo={photo} />
  </section>;
}
