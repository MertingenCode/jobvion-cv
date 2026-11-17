import { z } from "zod";
import { adminSession } from "@/lib/admin/access";
import { permitted } from "@/lib/admin/roles";
import { cvError, cvJson, cvSameOrigin, readBytes } from "@/lib/cv/http";

const lookup = z.strictObject({ user: z.uuid() });
const change = lookup.extend({
  id: z.uuid(), amount: z.number().int().min(-100).max(100).refine((amount) => amount !== 0),
  grant: z.uuid().nullable(), reason: z.string().trim().min(8).max(300), confirm: z.literal(true),
}).refine(({ amount, grant }) => amount > 0 ? grant === null : grant !== null);

export async function POST(request: Request) {
  if (!cvSameOrigin(request)) return cvError("unauthorized", 403);

  const session = await adminSession();
  if (!session?.mfa || !permitted(session.role, "audit")) return cvError("unauthorized", 403);
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return cvError("invalid", 400);
  try {
    const input = z.union([change, lookup]).parse(JSON.parse((await readBytes(request, 2048)).toString("utf8")));
    if ("amount" in input) {
      const adjusted = await session.supabase.rpc("adjust_promo", {
        p_request: input.id, p_user: input.user, p_grant: input.grant, p_amount: input.amount, p_reason: input.reason,
      });
      if (adjusted.error) return cvError("conflict", 409);
    }
    const { data, error } = await session.supabase.rpc("read_promo", { p_user: input.user });
    return error ? cvError("unavailable", 503) : cvJson(data);
  } catch {
    return cvError("invalid", 400);
  }
}
