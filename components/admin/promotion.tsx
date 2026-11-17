"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/config";
import { useTranslations } from "next-intl";

type Inventory = {
  free: number; paid: number; promo: number; refunds: number;
  ledger: { id: string; bucket: string; reason: string; delta: number; created_at: string }[];
  grants: { id: string; amount: number; remaining: number; expires_at: string }[];
  history: { id: string; grant_id: string; delta: number; reason: string; created_at: string }[];
};

export function Promotion({ locale, user }: { locale: Locale; user?: string }) {
  const t = useTranslations("release");
  const turkish = locale === "tr";
  const request = useRef<{ payload: string; id: string } | null>(null);
  const [operation, setOperation] = useState("lookup");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [inventory, setInventory] = useState<Inventory>();
  const formatDate = (date: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(date));
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = new FormData(event.currentTarget);
    const user = form.get("user");
    const input = operation === "lookup" ? { user } : {
      user, amount: Number(form.get("amount")) * (operation === "revoke" ? -1 : 1),
      grant: form.get("grant") || null, reason: form.get("reason"), confirm: form.get("confirm") === "on",
    };
    const payload = JSON.stringify(input);
    if ("amount" in input && request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    setProblem("");
    try {
      const result = await fetch("/api/admin/promotion", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify("amount" in input ? { ...input, id: request.current?.id } : input) });
      if (!result.ok) { setProblem(t(result.status === 409 ? "conflict" : "invalid")); return; }
      setInventory(await result.json());
      request.current = null;
    } catch {
      setProblem(t("unavailable"));
    } finally {
      setBusy(false);
    }
  }
  return <div className="release-stack">
    <form className="release-stack" onSubmit={submit}>
      <label>{turkish ? "Kullanıcı kimliği" : "User ID"} <Input name="user" defaultValue={user} required /></label>
      <label>{turkish ? "İşlem" : "Action"} <select value={operation} onChange={(event) => setOperation(event.target.value)}>
        <option value="lookup">{t("ledger")}</option><option value="grant">{t("grant")}</option><option value="revoke">{t("revoke")}</option>
      </select></label>
      {operation !== "lookup" && <>
        <label>{t("credits")} <Input name="amount" type="number" min={1} max={100} required /></label>
        {operation === "revoke" && <label>{turkish ? "Hibe kimliği" : "Grant ID"} <Input name="grant" required /></label>}
        <label>{t("reason")} <Input name="reason" minLength={8} maxLength={300} required /></label>
        <label><input type="checkbox" name="confirm" required /> {turkish ? "İşlemi onaylıyorum" : "I confirm this adjustment"}</label>
      </>}
      <Button type="submit" disabled={busy}>{operation === "lookup" ? t("ledger") : t(operation === "grant" ? "grant" : "revoke")}</Button>
      {problem && <p role="alert">{problem}</p>}
    </form>
    {inventory && <section className="release-stack" aria-live="polite">
      <h2>{t("promotion")}</h2>
      <p>{turkish ? "Ücretsiz" : "Free"} {inventory.free} · {turkish ? "Ücretli" : "Paid"} {inventory.paid} · {t("promotion")} {inventory.promo}</p>
      {inventory.refunds >= 2 && <p className="form-error">{turkish ? "İnceleme için işaretlendi" : "Flagged for review"} · {inventory.refunds} {turkish ? "iade işlemi" : "refund adjustments"}</p>}
      {inventory.grants.length === 0 && <p>{t("noActivity")}</p>}
      {inventory.grants.map((grant) => <p key={grant.id}><code>{grant.id}</code> · {grant.remaining}/{grant.amount} · {formatDate(grant.expires_at)}</p>)}
      <h2>{t("ledger")}</h2>
      {inventory.history.map((movement) => <p key={movement.id}>{formatDate(movement.created_at)} · {movement.delta} · {movement.reason}</p>)}
      {inventory.ledger.map((movement) => <p key={movement.id}>{formatDate(movement.created_at)} · {movement.delta} · {movement.bucket} · {movement.reason}</p>)}
    </section>}
  </div>;
}
