import Image from "next/image";
import { coverAlt, coverUrl } from "@/lib/blog/cover";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { routeLocale } from "@/lib/admin/ui";
import { editorPost } from "@/lib/admin/blog-data";
import { ArticleBody } from "@/components/blog/article";

export default async function PreviewPost({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const locale = await routeLocale(params);
  const { id } = await params;
  const { post } = await editorPost(locale, id);
  const t = await getTranslations({ locale, namespace: "admin" });
  const alt = await coverAlt(id);
  return <>
    <div className="studio-actions"><Link href={`/${locale}/admin/blog/${id}`}>{t("back")}</Link><span>{t(post.status)}</span></div>
    <article className="article-layout" lang={post.locale}>
      <h1>{post.title}</h1><p className="lede">{post.excerpt}</p>{alt && <Image className="article-cover" src={coverUrl(id)} alt={alt} width={600} height={400} unoptimized />}
      <ArticleBody body={post.body} />
    </article>
  </>;
}
