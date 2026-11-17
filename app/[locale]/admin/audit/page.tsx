import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/access";
import { pageNumber, routeLocale, utcLabel } from "@/lib/admin/ui";
import { Pager } from "@/components/admin/common";

const auditSchema = z.array(z.object({
  id: z.number(), actor_id: z.uuid().nullable(), target_id: z.uuid().nullable(), action: z.string(), occurred_at: z.string(),
}));

export default async function Audit({ params, searchParams }: {
  params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string }>;
}) {
  const locale = await routeLocale(params);
  const { supabase } = await requireAdmin(locale, "audit");
  const t = await getTranslations({ locale, namespace: "admin" });
  const page = pageNumber((await searchParams).page);
  const offset = (page - 1) * 25;
  const { data, error } = await supabase.from("admin_audit").select("id,actor_id,target_id,action,occurred_at")
    .order("occurred_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 25);
  const checked = auditSchema.safeParse(data);
  const rows = !error && checked.success ? checked.data : null;
  return <>
    <h1>{t("audit")}</h1>
    {rows && rows.length > 0 ? <div className="studio-rows">
      <table><thead><tr>{(["action", "actor", "target", "date"] as const).map((field) => <th key={field} scope="col">{t(field)}</th>)}</tr></thead>
        <tbody>{rows.slice(0, 25).map((event) => <tr key={event.id}>
          <th scope="row">{event.action}</th>
          <td>{event.actor_id ?? "—"}</td><td>{event.target_id ?? "—"}</td><td>{utcLabel(locale, event.occurred_at)} UTC</td>
        </tr>)}</tbody></table>
    </div> : <p role="status">{t(rows ? "empty" : "unavailable")}</p>}
    {rows && (page > 1 || rows.length > 25) && <Pager page={page} more={rows.length > 25} />}
  </>;
}
