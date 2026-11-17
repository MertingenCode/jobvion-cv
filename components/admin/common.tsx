import Link from "next/link";
import { useTranslations } from "next-intl";
import { notices } from "@/lib/admin/ui";

export function Notice({ value }: { value: unknown }) {
  const t = useTranslations("admin");
  const message = notices.find((notice) => value === notice);
  if (!message) return null;
  return <p className={message === "saved" ? "form-success" : "form-error"} role="status">{t(message)}</p>;
}

export function Pager({ page, more }: { page: number; more: boolean }) {
  const t = useTranslations("admin");
  return (
    <nav className="studio-actions" aria-label={t("pager", { page })}>
      {page > 1 && <Link href={`?page=${page - 1}`}>{t("previous")}</Link>}
      <span>{t("pager", { page })}</span>
      {more && page < 999 && <Link href={`?page=${page + 1}`}>{t("next")}</Link>}
    </nav>
  );
}
