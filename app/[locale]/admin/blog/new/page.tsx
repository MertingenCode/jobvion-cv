import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/admin/access";
import { routeLocale } from "@/lib/admin/ui";
import { BlogEditor } from "@/components/admin/blog-editor";

export default async function NewPost({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await routeLocale(params);
  await requireAdmin(locale, "write");
  const t = await getTranslations({ locale, namespace: "admin" });
  return <><h1>{t("newPost")}</h1><BlogEditor locale={locale} /></>;
}
