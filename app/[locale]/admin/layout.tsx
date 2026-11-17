import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { adminSession } from "@/lib/admin/access";
import { permitted, type AdminPermission } from "@/lib/admin/roles";
import { routeLocale } from "@/lib/admin/ui";
import "./studio.css";

export const metadata = { robots: { index: false, follow: false } };

const sections = [
  { path: "", label: "overview", permission: null },
  ...(["analytics", "ai-usage", "finance", "credits", "system"] as const).map((item) =>
    ({ path: item, label: item, permission: "reports" as const })),
  { path: "users", label: "users", permission: "accounts" },
  { path: "audit", label: "audit", permission: "audit" },
  { path: "roles", label: "roles", permission: "roles" },
  { path: "blog", label: "blog", permission: "write" },
] as const satisfies readonly { path: string; label: string; permission: AdminPermission | null }[];

export default async function AdminLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await routeLocale(params);
  const session = await adminSession();
  if (!session) notFound();
  const t = await getTranslations({ locale, namespace: "admin" });
  const release = await getTranslations({ locale, namespace: "release" });
  const root = `/${locale}/admin`;
  const { role } = session;
  const links = sections.filter(({ permission }) => !permission || permitted(role, permission))
    .map(({ path, label }) => <Link key={label} href={path ? root + "/" + path : root}>{t(label)}</Link>);

  if (permitted(role, "audit")) links.push(<Link key="promotion" href={root + "/promotion"}>{release("promotion")}</Link>);

  return (
    <div className="container studio">
      <div className="studio-heading">
        <Link href={root}>{t("title")}</Link>
        <span>{t(role)}</span>
      </div>
      {session.mfa && <>
        <nav className="studio-nav studio-nav-wide" aria-label={t("title")}>{links}</nav>
        <details className="studio-mobile-menu">
          <summary>{t("navigation")}</summary>
          <nav className="studio-nav" aria-label={t("title")}>{links}</nav>
        </details>
      </>}
      {children}
    </div>
  );
}
