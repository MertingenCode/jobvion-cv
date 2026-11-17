import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { routeLocale } from "@/lib/admin/ui";
import { publicPosts, publishedLinks } from "@/lib/blog/public";
import { readEnv } from "@/lib/env";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await routeLocale(params);
  const t = await getTranslations({ locale, namespace: "blog" });
  const origin = readEnv().APP_ORIGIN;
  const { posts } = await publicPosts(locale);
  const available = new Set((await publishedLinks()).map((item) => item.locale));
  const languages = Object.fromEntries([...available].map((code) => [code, origin + `/${code}/blog`]));
  if (languages.en) languages["x-default"] = languages.en;
  return {
    title: `${t("title")} | Jobvion`,
    description: t("summary"),
    alternates: { canonical: origin + `/${locale}/blog`, languages },
    robots: { index: Boolean(posts.length), follow: true },
  };
}

export default async function BlogIndex({ params }: Props) {
  const locale = await routeLocale(params);
  const t = await getTranslations({ locale, namespace: "blog" });
  const { posts, unavailable } = await publicPosts(locale);
  const hasEnglish = locale !== "en" && !posts.length && (await publicPosts("en")).posts.length > 0;
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" });
  return <section className="container blog-index">
    <h1>{t("title")}</h1>
    <p className="lede">{t("summary")}</p>
    {posts.length ? <ol className="blog-rows">
      {posts.map((post) => <li key={post.id}>
        <article>
          <h2><Link href={`/${locale}/blog/${post.slug}`}>{post.title}</Link></h2>
          <p>{post.excerpt}</p>
          {post.published_at && <time dateTime={post.published_at}>{date.format(new Date(post.published_at))}</time>}
        </article>
      </li>)}
    </ol> : <p role="status">{t(unavailable ? "unavailable" : "empty")}</p>}
    {hasEnglish && <Link className="blog-link" href="/en/blog">{t("english")}</Link>}
  </section>;
}
