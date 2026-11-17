import Image from "next/image";
import { coverAlt, coverUrl } from "@/lib/blog/cover";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { routeLocale } from "@/lib/admin/ui";
import { publicPost, publishedLinks } from "@/lib/blog/public";
import { blogSlug } from "@/lib/blog/schema";
import { readEnv } from "@/lib/env";
import { ArticleBody } from "@/components/blog/article";
import { localeNames } from "@/i18n/config";

type Props = { params: Promise<{ locale: string; slug: string }> };

async function article(params: Props["params"]) {
  const locale = await routeLocale(params);
  const { slug } = await params;
  if (!blogSlug.safeParse(slug).success) notFound();
  const post = await publicPost(locale, slug);
  if (!post) notFound();
  return post;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await article(params);
  const origin = readEnv().APP_ORIGIN;
  const canonical = origin + `/${post.locale}/blog/${post.slug}`;
  const translations = await publishedLinks(post.translation_group);
  const languages = Object.fromEntries(translations.map(({ locale, slug }) => [locale, origin + `/${locale}/blog/${slug}`]));
  if (languages.en) languages["x-default"] = languages.en;
  const title = post.seo_title || post.title;
  const description = post.seo_description || post.excerpt;
  return {
    title: title + " | Jobvion", description, alternates: { canonical, languages },
    openGraph: { type: "article", title, description, url: canonical, publishedTime: post.published_at ?? undefined,
      images: await coverAlt(post.id, true) ? [origin + coverUrl(post.id)] : [origin + "/" + post.locale + "/opengraph-image"], modifiedTime: post.updated_at, authors: [post.author], locale: post.locale },
  };
}

export default async function BlogArticle({ params }: Props) {
  const post = await article(params);
  const t = await getTranslations({ locale: post.locale, namespace: "blog" });
  const canonical = readEnv().APP_ORIGIN + `/${post.locale}/blog/${post.slug}`;
  const translations = await publishedLinks(post.translation_group);
  const json = {
    "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title, description: post.excerpt,
    author: { "@type": "Organization", name: post.author }, datePublished: post.published_at,
    dateModified: post.updated_at, inLanguage: post.locale, mainEntityOfPage: canonical,
  };
  const alt = await coverAlt(post.id, true);
  const nonce = (await headers()).get("x-jobvion-nonce") ?? undefined;
  const date = new Intl.DateTimeFormat(post.locale, { dateStyle: "long", timeZone: "UTC" });
  return (
    <article className="container article-layout">
      <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(json).replace(/</g, "\\u003c") }} />
      <Link className="blog-link" href={`/${post.locale}/blog`}>{t("back")}</Link>
      <h1>{post.title}</h1><p className="lede">{post.excerpt}</p>
      <p className="article-meta">{t("by", { author: post.author })} {post.published_at && <time dateTime={post.published_at}>{date.format(new Date(post.published_at))}</time>}</p>
      {alt && <Image className="article-cover" src={coverUrl(post.id)} alt={alt} width={600} height={400} unoptimized />}
      <ArticleBody body={post.body} />
      {translations.filter((item) => item.locale !== post.locale).map((item) =>
        <Link className="blog-link" key={item.locale} href={`/${item.locale}/blog/${item.slug}`} lang={item.locale}>{localeNames[item.locale]}</Link>)}
    </article>
  );
}
