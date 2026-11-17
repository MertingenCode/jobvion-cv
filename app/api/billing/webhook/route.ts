import { readBytes,cvError,cvJson } from "@/lib/cv/http";
import { creditEvent,verifyPaddle } from "@/lib/billing/paddle";
import { serviceSupabase } from "@/lib/supabase/admin";
import { readEnv } from "@/lib/env";

export async function POST(request:Request) {
  const secret=process.env.PADDLE_WEBHOOK_SECRET;
  if(!secret||!readEnv().SUPABASE_SERVICE_ROLE_KEY)return cvError("unavailable",503);
  let raw:Buffer;
  try {raw=await readBytes(request,512*1024);}catch{return cvError("invalid",413);}
  if(!verifyPaddle(raw,request.headers.get("paddle-signature"),secret))return cvError("unauthorized",401);
  let event:ReturnType<typeof creditEvent>;
  try{event=creditEvent(JSON.parse(raw.toString("utf8")));}catch{return cvError("invalid",400);}
  if(!event)return cvJson({received:true});
  const {error}=await serviceSupabase().rpc("process_credit_event",{p_event:event.event,p_kind:event.kind,p_fields:event.fields});
  if (error) {
    console.warn("[jobvion] Paddle credit event processing failed");
    return cvError("unavailable",503);
  }
  return cvJson({received:true});
}
