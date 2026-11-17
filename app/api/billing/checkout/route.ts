import { randomUUID } from "node:crypto";
import { z } from "zod";
import { cvSession } from "@/lib/cv/data";
import { cvError,cvJson,cvSameOrigin,readCvJson } from "@/lib/cv/http";
import { cvLocale } from "@/lib/cv/model";
import { serviceSupabase } from "@/lib/supabase/admin";
import { readEnv } from "@/lib/env";
import { packIds,paddleClientToken,transactionId } from "@/lib/billing/paddle";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";

const requestSchema=z.strictObject({pack:z.enum(packIds),locale:cvLocale});

export async function POST(request:Request) {
  if(!cvSameOrigin(request))return cvError("unauthorized",403);
  const session=await cvSession();
  if(!session)return cvError("unauthorized",401);
  const env=readEnv();
  const key=process.env.PADDLE_API_KEY, mode=process.env.PADDLE_ENVIRONMENT;
  if(!key||!paddleClientToken(mode,process.env.PADDLE_CLIENT_TOKEN)||!env.SUPABASE_SERVICE_ROLE_KEY||!(mode==="sandbox"||mode==="production"))return cvError("unavailable",503);
  if(!await allowAuthAttempt("billing",session.id))return cvError("limited",429);
  const input=requestSchema.safeParse(await readCvJson(request));
  if(!input.success)return cvError("invalid",400);
  const db=serviceSupabase();
  const {data:pack}=await db.from("credit_packages").select("id,paddle_price_id").eq("id",input.data.pack).maybeSingle();
  if(!pack?.paddle_price_id)return cvError("unavailable",503);
  const id=randomUUID();
  const pending=await db.from("checkout_intents").insert({id,user_id:session.id,package_id:pack.id});
  if(pending.error)return cvError("unavailable",503);
  try{
    const payment=await fetch((mode==="sandbox"?"https://sandbox-api.paddle.com":"https://api.paddle.com")+"/transactions",{
      method:"POST",signal:AbortSignal.timeout(9000),redirect:"error",
      headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
      body:JSON.stringify({items:[{price_id:pack.paddle_price_id,quantity:1}],collection_mode:"automatic",
        custom_data:{jobvion_intent:id},checkout:{url:env.APP_ORIGIN+"/"+input.data.locale+"/checkout"}}),
    });
    if(!payment.ok)return cvError("unavailable",503);
    const {data}=z.object({data:z.object({id:transactionId})}).parse(await payment.json());
    const linked=await db.from("checkout_intents").update({transaction_id:data.id}).eq("id",id);
    if(linked.error)return cvError("unavailable",503);
    return cvJson({location:"/"+input.data.locale+"/checkout?_ptxn="+data.id});
  }catch{return cvError("unavailable",503);}
}
