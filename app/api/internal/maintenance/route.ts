import { createHash,timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { cvError,cvJson } from "@/lib/cv/http";
import { readEnv } from "@/lib/env";
import { serviceSupabase } from "@/lib/supabase/admin";

const digest=(text:string)=>createHash("sha256").update(text).digest();
export async function POST(request:Request) {
  const env=readEnv(), secret=process.env.MAINTENANCE_CRON_SECRET;
  if(!secret||secret.length<32||!timingSafeEqual(digest(request.headers.get("authorization")??""),digest("Bearer "+secret)))return cvError("unauthorized",403);
  if(!env.SUPABASE_SERVICE_ROLE_KEY)return cvError("unavailable",503);
  const db=serviceSupabase();
  const [maintenance,claimed]=await Promise.all([db.rpc("maintain_release_data"),db.rpc("claim_account_deletions")]);
  const ids=z.array(z.uuid()).safeParse(claimed.data);
  if(maintenance.error||claimed.error||!ids.success)return cvError("unavailable",503);
  let deleted=0,failed=0;
  for(const id of ids.data) {
    const result=await db.auth.admin.deleteUser(id,false);
    if(result.error)failed++;else deleted++;
  }
  if(failed)console.warn("[jobvion] Account deletion jobs require retry");
  return cvJson({deleted,failed});
}
