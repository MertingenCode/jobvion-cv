import { getTranslations } from "next-intl/server";
import { routeLocale } from "@/lib/admin/ui";
import { marketingMetadata } from "@/lib/seo";
import { creditOffers } from "@/lib/billing/catalog";
import { BuyCredits } from "@/components/billing/buy";
import Link from "next/link";

type Props={params:Promise<{locale:string}>};
export async function generateMetadata({params}:Props){
  const locale=await routeLocale(params),t=await getTranslations({locale,namespace:"release"});
  return marketingMetadata(locale,"/pricing",t("pricing"),t("checkoutHelp"));
}
export default async function Pricing({params}:Props){
  const locale=await routeLocale(params),t=await getTranslations({locale,namespace:"release"});
  const currency=new Intl.NumberFormat(locale,{style:"currency",currency:"USD",currencyDisplay:"code"});
  return <section className="container release-page release-stack">
    <h1>{t("pricing")}</h1><p>{t("checkoutHelp")}</p>
    <ul className="release-grid release-offers">
      {creditOffers.map((pack)=><li key={pack.id}><h2>{t("packCredits", { credits: pack.credits })}</h2><p>{currency.format(pack.usd)}</p>
        <BuyCredits pack={pack.id} locale={locale}/></li>)}
    </ul>
    <Link className="blog-link" href={`/${locale}/legal/refunds`}>{t("refundHelp")}</Link>
  </section>;
}
