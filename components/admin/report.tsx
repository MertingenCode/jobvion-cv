import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { Locale } from "@/i18n/config";
import type { serverSupabase } from "@/lib/supabase/server";
import { utcLabel } from "@/lib/admin/ui";
import { Button } from "@/components/ui/button";

export const reportSections = ["analytics", "ai-usage", "finance", "credits", "system"] as const;
type Section = (typeof reportSections)[number] | "overview";
const reportSchema = z.object({
  asOf: z.string(),
  newUsers: z.number(),
  activeUsers: z.number(),
  completedPacks: z.number(),
  creditsSpent: z.number(),
  paidOrders: z.number(),
  aiCalls: z.number(),
  aiFailures: z.number(),
  aiCost: z.number().nullable(),
  finance: z.array(z.object({ currency: z.string().regex(/^[A-Z]{3}$/), gross: z.number(), refunded: z.number() })),
});

const overviewKeys = ["newUsers", "activeUsers", "completedPacks", "creditsSpent", "paidOrders"] as const;
const aiKeys = ["aiCalls", "aiFailures", "aiCost"] as const;

export async function Report({ locale, db, section, period }: {
  locale: Locale;
  db: NonNullable<Awaited<ReturnType<typeof serverSupabase>>>;
  section: Section;
  period?: string;
}) {
  const days = period === "7" ? 7 : period === "90" ? 90 : 30;
  const t = await getTranslations({ locale, namespace: "admin" });
  const { data, error } = await db.rpc("admin_overview", { p_days: days });
  const parsed = reportSchema.safeParse(data);
  const report = !error && parsed.success ? parsed.data : null;
  const number = new Intl.NumberFormat(locale);
  function money(value: number, currency: string) {
    return new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay: "code" }).format(value);
  }
  function orderAmount(value: number, currency: string) {
    const digits = new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return money(value / 10 ** digits, currency);
  }
  const keys = section === "ai-usage" ? aiKeys : section === "credits" ? ["creditsSpent"] as const : overviewKeys;
  return (
    <>
      {section !== "system" && <form className="studio-actions">
        <label htmlFor="report-days">{t("period")}</label>
        <select className="input" style={{ width: "auto" }} id="report-days" name="days" defaultValue={days}>
          {[7, 30, 90].map((days) => <option key={days} value={days}>{t(`days${days}`)}</option>)}
        </select>
        <Button type="submit" variant="outline">{t("apply")}</Button>
      </form>}
      {report ? <>
        <p className="studio-meta">{t("asOf", { time: utcLabel(locale, report.asOf) })}</p>
        {section === "system" ? <p>{t("database")}</p> : section === "finance" ? <>
          <p>{t("financeDefinition")}</p>
          {report.finance.length > 0 ? <div className="studio-rows"><table>
            <thead><tr><th scope="col">{t("currency")}</th><th scope="col">{t("gross")}</th><th scope="col">{t("refunded")}</th></tr></thead>
            <tbody>{report.finance.map((row) => <tr key={row.currency}>
              <th scope="row">{row.currency}</th><td>{orderAmount(row.gross, row.currency)}</td><td>{orderAmount(row.refunded, row.currency)}</td>
            </tr>)}</tbody>
          </table></div> : <p>{t("empty")}</p>}
        </> : <>
          <dl className="studio-list">{keys.map((key) => {
            const value = report[key];
            return <div key={key}><dt>{t(key)}</dt><dd>{value === null ? t("empty") : key === "aiCost" ? money(value, "USD") : number.format(value)}</dd></div>;
          })}</dl>
          <p className="studio-meta">{t(section === "ai-usage" ? "aiDefinition" : section === "credits" ? "source" : "activeDefinition")}</p>
        </>}
      </> : <p role="status">{t("unavailable")}</p>}
    </>
  );
}
