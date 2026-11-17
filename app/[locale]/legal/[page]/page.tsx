import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { routeLocale } from "@/lib/admin/ui";
import { legalPages,policies } from "@/lib/privacy/policies";
import { processors } from "@/config/processors";

type Props={params:Promise<{locale:string;page:string}>};
export const metadata={robots:{index:false,follow:true}};
export default async function LegalPage({params}:Props){
  const locale=await routeLocale(params),language=locale==="tr"?"tr":"en";
  const key=(await params).page;
  const page=legalPages.find((item)=>item===key);
  if(!page)notFound();
  const t=await getTranslations({locale,namespace:"release"}),content=policies[language][page];
  return <article className="container article-layout">
    <p className="cv-tag">{t("draft")}</p>
    <div lang={language}><h1>{content.title}</h1><div className="article-copy">{content.body.map((paragraph)=><p key={paragraph}>{paragraph}</p>)}</div></div>
    {page==="refunds" && <a href="https://paddle.net/" className="blog-link">{t("refundHelp")} · Paddle</a>}
    {page==="privacy"&&<ul lang="en" className="release-list">{processors.map((processor)=><li key={processor.system}>
      <strong>{processor.system}</strong><p>{processor.purpose}</p><p>{processor.region}</p>
    </li>)}</ul>}
    <nav aria-label={t("legal")} className="cv-toolbar">{legalPages.filter((item)=>item!==page).map((item)=>
      <Link className="blog-link" lang={language} key={item} href={`/${locale}/legal/${item}`}>{policies[language][item].title}</Link>)}</nav>
  </article>;
}
