import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/access";
import { pageNumber, routeLocale, utcLabel } from "@/lib/admin/ui";
import { blogSummary } from "@/lib/blog/schema";
import { Pager } from "@/components/admin/common";
import { buttonVariants } from "@/components/ui/button";
import { localeNames } from "@/i18n/config";

export default async function BlogQueue({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const locale = await routeLocale(params);
  const { supabase } = await requireAdmin(locale, "write");
  const t = await getTranslations({ locale, namespace: "admin" });
  const page = pageNumber((await searchParams).page);
  const offset = (page - 1) * 25;
  const { data, error } = await supabase.from("blog_posts").select(Object.keys(blogSummary.shape).join(","))
    .order("updated_at", { ascending: false }).order("id").range(offset, offset + 25);
  const result = z.array(blogSummary).safeParse(data);
  const posts = !error && result.success ? result.data : null;
  const root = `/${locale}/admin/blog`;
  return <>
    <div className="studio-page-heading"><h1>{t("blog")}</h1><Link href={root + "/new"} className={buttonVariants()}>{t("newPost")}</Link></div>
    {posts && posts.length > 0 ? <div className="studio-rows">
      <table>
        <thead><tr><th scope="col">{t("titleField")}</th><th scope="col">{t("language")}</th><th scope="col">{t("status")}</th><th scope="col">{t("date")}</th></tr></thead>
        <tbody>{posts.slice(0, 25).map((post) => <tr key={post.id}>
          <th scope="row"><Link href={root + "/" + post.id} lang={post.locale}>{post.title}</Link></th>
          <td>{localeNames[post.locale]}</td><td>{t(post.status)}</td><td>{utcLabel(locale, post.updated_at)} UTC</td>
        </tr>)}</tbody>
      </table>
    </div> : <p role="status">{t(posts ? "empty" : "unavailable")}</p>}
    {posts && (page > 1 || posts.length > 25) && <Pager page={page} more={posts.length > 25} />}
  </>;
}
