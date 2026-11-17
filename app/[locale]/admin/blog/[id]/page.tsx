import { BlogCover } from "@/components/admin/blog-cover";
import { coverAlt } from "@/lib/blog/cover";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { routeLocale } from "@/lib/admin/ui";
import { editorPost } from "@/lib/admin/blog-data";
import { permitted } from "@/lib/admin/roles";
import { BlogEditor } from "@/components/admin/blog-editor";
import { BlogWorkflow } from "@/components/admin/blog-workflow";
import { Notice } from "@/components/admin/common";

const revisionsSchema = z.array(z.object({ revision: z.number(), created_at: z.string() }));

export default async function EditPost({ params, searchParams }: {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ notice?: string }>;
}) {
  const locale = await routeLocale(params);
  const { id } = await params;
  const { supabase, post, role } = await editorPost(locale, id);
  const t = await getTranslations({ locale, namespace: "admin" });
  const { data } = await supabase.from("blog_revisions").select("revision,created_at")
    .eq("post_id", id).order("revision", { ascending: false }).limit(100);
  const revisions = revisionsSchema.safeParse(data);

  return <>
    <h1 lang={post.locale}>{post.title}</h1>
    <div className="studio-actions">
      <Link href={`/${locale}/admin/blog/${id}/preview`}>{t("preview")}</Link>
      {post.status === "published" && <Link href={`/${post.locale}/blog/${post.slug}`}>{t("publicPost")}</Link>}
    </div>
    <Notice value={(await searchParams).notice} />
    {(post.status === "draft" || post.status === "review") && <BlogEditor key={post.revision} locale={locale} post={post} />}
    {(post.status === "draft" || post.status === "review") && <BlogCover id={id} alt={await coverAlt(id)} turkish={locale === "tr"} />}
    <BlogWorkflow locale={locale} post={post} publish={permitted(role, "publish")} revisions={revisions.data ?? []} />
  </>;
}
