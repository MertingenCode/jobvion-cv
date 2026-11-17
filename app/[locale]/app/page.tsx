import Link from "next/link";
import { adminSession } from "@/lib/admin/access";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { signOut } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/session";
import { isLocale } from "@/i18n/config";
import { Button, buttonVariants } from "@/components/ui/button";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale });
  return { title: t("workspace") + " | Jobvion", robots: { index: false, follow: false } };
}

export default async function Workspace({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  await requireUser(locale);
  const t = await getTranslations({ locale });
  const admin = await adminSession();
  const adminMessages = await getTranslations({ locale, namespace: "admin" });
  const sections = await getTranslations({ locale, namespace: "release" });
  const authFlow = await getTranslations({ locale, namespace: "authFlow" });
  const cv = await getTranslations({ locale, namespace: "cv" });
  return (
    <section className="container workspace">
      <h1>{t("workspace")}</h1>
      <p className="lede">{t("workspaceText")}</p>
      <Link className={buttonVariants()} href={`/${locale}/app/cv`}>{cv("editor")}</Link>
      <nav className="release-nav">
        {(["application", "billing", "account"] as const).map((section) =>
          <Link key={section} className="blog-link" href={"/" + locale + "/app/" + section}>{sections(section)}</Link>)}
        <Link className="blog-link" href={"/" + locale + "/app/application?mode=letter"}>{authFlow("aiLetter")}</Link>
      </nav>
      {admin && <Link className="blog-link" href={`/${locale}/admin`}>{adminMessages("title")}</Link>}
      <form action={signOut.bind(null, locale)}>
        <Button type="submit" variant="outline">{t("logout")}</Button>
      </form>
    </section>
  );
}
