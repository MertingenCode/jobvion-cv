import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { routeLocale } from "@/lib/admin/ui";
import { cvSession } from "@/lib/cv/data";
import { serviceSupabase } from "@/lib/supabase/admin";
import { readEnv } from "@/lib/env";

export const metadata={robots:{index:false,follow:false}};
export default async function Billing({params}:{params:Promise<{locale:string}>}){
  const locale=await routeLocale(params),session=await cvSession();
  if(!session)redirect(`/${locale}/login`);
  const t=await getTranslations({locale,namespace:"release"}),admin=await getTranslations({locale,namespace:"admin"});
  const {db,id}=session;
  if(readEnv().SUPABASE_SERVICE_ROLE_KEY)await serviceSupabase().rpc("reset_free_credits",{p_user_id:id});
  const [balance,orders,ledger,promos]=await Promise.all([
    db.from("credit_accounts").select("free_credits,paid_credits").eq("user_id",id).maybeSingle(),
    db.from("purchases").select("transaction_id,currency,amount_cents,refunded_cents,created_at").eq("user_id",id).order("created_at",{ascending:false}).limit(50),
    db.from("credit_ledger").select("id,delta,reason,created_at").eq("user_id",id).order("created_at",{ascending:false}).limit(50),
    db.from("promo_grants").select("remaining").eq("user_id",id).gt("expires_at",new Date().toISOString()),
  ]);
  const date=new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeZone:"UTC"});
  function money(value:number,currency:string){
    const formatter=new Intl.NumberFormat(locale,{style:"currency",currency,currencyDisplay:"code"});
    return formatter.format(value/10**(formatter.resolvedOptions().maximumFractionDigits??2));
  }
  const failed=balance.error||orders.error||ledger.error||promos.error;
  return <section className="container cv-workspace release-stack">
    <h1>{t("billing")}</h1>
    {failed?<p role="status">{t("unavailable")}</p>:<>
      <dl className="release-grid"><div><dt>{admin("free")}</dt><dd>{balance.data?.free_credits??3}</dd></div>
        <div><dt>{admin("paid")}</dt><dd>{balance.data?.paid_credits??0}</dd></div>
        <div><dt>{t("promotion")}</dt><dd>{promos.data?.reduce((sum,row)=>sum+row.remaining,0)??0}</dd></div></dl>
      <Link className="blog-link" href={`/${locale}/pricing`}>{t("buy")}</Link>
      <h2>{t("orders")}</h2>
      {orders.data?.length?<ul className="release-list">{orders.data.map((row)=><li key={row.transaction_id}>{date.format(new Date(row.created_at))} · {money(row.amount_cents,row.currency)}
        {row.refunded_cents>0?" · "+admin("refunded")+" "+money(row.refunded_cents,row.currency):""}</li>)}</ul>:<p>{t("noActivity")}</p>}
      <h2>{t("ledger")}</h2>
      {ledger.data?.length?<ul className="release-list">{ledger.data.map((row)=><li key={row.id}>{date.format(new Date(row.created_at))} · {row.delta>0?"+":""}{row.delta} · {row.reason}</li>)}</ul>:<p>{t("noActivity")}</p>}
    </>}
    <nav className="release-nav">
      <a className="blog-link" href="https://paddle.net/">{t("refundHelp")} · Paddle</a>
      <Link className="blog-link" href={"/" + locale + "/legal/refunds"}>{t("refundPolicy")}</Link>
    </nav>
  </section>;
}
