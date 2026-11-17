import { createHmac,timingSafeEqual } from "node:crypto";
import { z } from "zod";

export function paddleClientToken(mode: string | undefined, token: string | undefined) {
  const prefix = mode === "sandbox" ? "test_" : mode === "production" ? "live_" : null;
  return prefix && token && token.startsWith(prefix) && /^[a-z_0-9]+$/i.test(token) ? token : undefined;
}

export const packIds=["starter","standard","large"] as const;
export const transactionId=z.string().regex(/^txn_[a-z\d]{26}$/);
const paddlePrice=z.string().regex(/^pri_[a-z\d]{26}$/);
const adjustmentId=z.string().regex(/^adj_[a-z\d]{26}$/);
const amount=z.string().regex(/^\d{1,10}$/).transform(Number).pipe(z.number().int().positive().max(2_147_483_647));
const currency=z.string().regex(/^[A-Z]{3}$/);
const event=z.object({event_id:z.string().regex(/^evt_[a-z\d]{26}$/),event_type:z.string().max(100),data:z.unknown()});
const completed=z.object({id:transactionId,status:z.literal("completed"),currency_code:currency,
  custom_data:z.object({jobvion_intent:z.uuid()}),
  items:z.tuple([z.object({price:z.object({id:paddlePrice}),quantity:z.literal(1)})]),
  details:z.object({totals:z.object({grand_total:amount})}),
});
const adjustment=z.object({id:adjustmentId,status:z.string(),action:z.string(),transaction_id:transactionId,currency_code:currency,
  totals:z.object({total:z.string()})});

export function verifyPaddle(raw:Uint8Array,signature:string|null,secret:string,now=Date.now()) {
  if(!signature||signature.length>1024)return false;
  const parts=signature.split(";").map((part)=>part.trim());
  const ts=parts.filter((part)=>/^ts=\d{10}$/.test(part));
  if(ts.length!==1||Math.abs(now-Number(ts[0].slice(3))*1000)>300_000)return false;
  const expected=createHmac("sha256",secret).update(ts[0].slice(3)+":").update(raw).digest();
  return parts.filter((part)=>/^h1=[\da-f]{64}$/i.test(part))
    .some((part)=>timingSafeEqual(expected,Buffer.from(part.slice(3),"hex")));
}

export function creditEvent(payload:unknown) {
  const e=event.parse(payload);
  if(e.event_type==="transaction.completed") {
    const row=completed.safeParse(e.data);
    if(!row.success) {
      if(!z.object({custom_data:z.object({jobvion_intent:z.string()})}).safeParse(e.data).success) return null;
      throw new Error("Invalid transaction payload");
    }
    const value=row.data;
    return {event:e.event_id,kind:e.event_type,fields:{transaction:value.id,intent:value.custom_data.jobvion_intent,
      price:value.items[0].price.id,currency:value.currency_code,amount:value.details.totals.grand_total}};
  }
  if(e.event_type!=="adjustment.created"&&e.event_type!=="adjustment.updated")return null;
  const value=adjustment.parse(e.data);
  if(value.action!=="refund"||value.status!=="approved")return null;
  return {event:e.event_id,kind:e.event_type,fields:{transaction:value.transaction_id,adjustment:value.id,
    currency:value.currency_code,amount:amount.parse(value.totals.total)}};
}
