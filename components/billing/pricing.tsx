import Link from "next/link";
import { Check, FileSearch, FileText, PencilLine } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { BuyCredits } from "@/components/billing/buy";
import { buttonVariants } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { creditOffers } from "@/lib/billing/catalog";

const steps = [
  { title: "analyzeTitle", text: "analyzeText", Icon: FileSearch },
  { title: "produceTitle", text: "produceText", Icon: FileText },
  { title: "reviseTitle", text: "reviseText", Icon: PencilLine },
] as const;

export async function Pricing({ locale, startHref }: { locale: Locale; startHref: string }) {
  const [t, release, landing] = await Promise.all([
    getTranslations({ locale, namespace: "pricing" }),
    getTranslations({ locale, namespace: "release" }),
    getTranslations({ locale, namespace: "landing" }),
  ]);
  const currency = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay: "code" });

  return (
    <section className="container landing-section" id="pricing">
      <div className="section-heading">
        <h2>{landing("pricingTitle")}</h2>
        <p>{t("intro")}</p>
      </div>
      <ul className="landing-prices">
        <li className="free-offer">
          <h3>{landing("free")}</h3>
          <strong>{currency.format(0)}</strong>
          <p>{t("freeDesc")}</p>
          <ul className="pricing-benefits">
            {(["freeTools", "freePdf", "freeAllowance"] as const).map((key) => (
              <li key={key}><Check size={17} aria-hidden="true" />{t(key)}</li>
            ))}
          </ul>
          <Link href={startHref} className={buttonVariants()}>{landing("start")}</Link>
        </li>
        {creditOffers.map(({ id, credits, usd }) => (
          <li key={id}>
            <h3>{release("packCredits", { credits })}</h3>
            <strong>{currency.format(usd)}</strong>
            <p>{t(id)}</p>
            <ul className="pricing-benefits">
              <li><Check size={17} aria-hidden="true" />{t("capacity", { count: credits })}</li>
              <li><Check size={17} aria-hidden="true" />{t("unit", { price: currency.format(usd / credits) })}</li>
              <li><Check size={17} aria-hidden="true" />{t("oneTime")}</li>
            </ul>
            <BuyCredits pack={id} locale={locale} />
          </li>
        ))}
      </ul>
      <p className="price-help">
        {release("checkoutHelp")}{" "}
        <Link className="blog-link" href={`/${locale}/legal/refunds`}>{release("refundPolicy")}</Link>
      </p>

      <section className="credit-guide" aria-labelledby="credit-guide-title">
        <div className="section-heading">
          <h3 id="credit-guide-title">{t("howTitle")}</h3>
          <p>{t("howIntro")}</p>
        </div>
        <ol className="credit-steps">
          {steps.map(({ title, text, Icon }) => (
            <li key={title}>
              <h4><Icon size={22} aria-hidden="true" />{t(title)}</h4>
              <p>{t(text)}</p>
            </li>
          ))}
        </ol>
        <p className="credit-example">{t("example")}</p>
        <div className="credit-questions">
          {(["balance", "expired", "templates"] as const).map((topic) => (
            <details key={topic}>
              <summary>{t(topic + "Title")}</summary>
              <p>{t(topic + "Text")}</p>
            </details>
          ))}
        </div>
      </section>
    </section>
  );
}
