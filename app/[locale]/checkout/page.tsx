import { notFound,redirect } from "next/navigation";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";
import { routeLocale } from "@/lib/admin/ui";
import { readEnv } from "@/lib/env";
import { serviceSupabase } from "@/lib/supabase/admin";
import { paddleClientToken, transactionId } from "@/lib/billing/paddle";
import { cvSession } from "@/lib/cv/data";
import { CheckoutWidget } from "@/components/billing/checkout";
import Link from "next/link";

export const metadata={robots:{index:false,follow:false}};
export default async function Checkout({params,searchParams}:{
  params:Promise<{locale:string}>;searchParams:Promise<{_ptxn?:string}>;
}){
  const locale=await routeLocale(params),session=await cvSession();
  if(!session)redirect(`/${locale}/login`);
  const txn=transactionId.safeParse((await searchParams)._ptxn);
  const mode=process.env.PADDLE_ENVIRONMENT,env=readEnv();
  const token=paddleClientToken(mode,process.env.PADDLE_CLIENT_TOKEN);
  if(!txn.success||!token||!env.SUPABASE_SERVICE_ROLE_KEY)notFound();
  const {data}=await serviceSupabase().from("checkout_intents").select("id")
    .eq("transaction_id",txn.data).eq("user_id",session.id).maybeSingle();
  if(!data)notFound();
  const t=await getTranslations({locale,namespace:"release"});
  return <section className="container release-page">
    <h1>{t("checkout")}</h1><p>{t("checkoutHelp")}</p>
    <div className="cv-toolbar">
      <Link className="blog-link" href={`/${locale}/legal/refunds`}>{t("refundHelp")}</Link>
      <Link className="blog-link" href={`/${locale}/app/billing`}>{t("billing")}</Link>
    </div>
    <CheckoutWidget token={token} sandbox={mode==="sandbox"} locale={locale} successUrl={env.APP_ORIGIN+`/${locale}/app/billing`}
      nonce={(await headers()).get("x-jobvion-nonce")??undefined}/>
  </section>;
}
