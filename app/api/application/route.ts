import { z } from "zod";
import { cvSession } from "@/lib/cv/data";
import { cvError,cvJson,cvSameOrigin,readCvJson } from "@/lib/cv/http";
import { cvLocale,profileSchema } from "@/lib/cv/model";
import { serviceSupabase } from "@/lib/supabase/admin";
import { readEnv } from "@/lib/env";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { applicationEvidence,buildApplication,groundReport,reportMatches,reportSchema,selectionSchema,stripContact } from "@/lib/application/model";
import { analysisPrompt,letterPrompt,tailoringPrompt } from "@/lib/application/prompts";
import { BudgetLimit,jsonCompletion,llmConfig } from "@/lib/application/llm";

const mutations=z.discriminatedUnion("operation",[
  z.strictObject({operation:z.literal("analyze"),text:z.string().trim().min(80).max(16000)}),
  z.strictObject({operation:z.literal("generate"),id:z.uuid(),request:z.uuid(),language:cvLocale,regenerate:z.boolean(),focus:z.enum(["application","letter"]).default("application")}),
  z.strictObject({operation:z.literal("edit"),id:z.uuid(),cover:z.string().trim().min(1).max(8000)}),
]);

export async function GET(request: Request) {
  const session = await cvSession();
  if (!session) return cvError("unauthorized", 401);
  if (!readEnv().SUPABASE_SERVICE_ROLE_KEY) return cvError("unavailable", 503);
  const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
  if (!id.success) return cvError("invalid", 400);
  const db = serviceSupabase();
  const saved = await db.from("job_matches").select("report,profile")
    .eq("user_id", session.id).eq("id", id.data).maybeSingle();
  if (saved.error) return cvError("unavailable", 503);
  if (!saved.data) return cvError("notFound", 404);
  const profile = profileSchema.parse(saved.data.profile);
  const report = reportSchema.parse(saved.data.report);
  const pack = await db.from("application_packs").select("output").eq("job_id", id.data).maybeSingle();
  if (pack.error) return cvError("unavailable", 503);
  return cvJson({ id: id.data, report, matches: reportMatches(report,profile), draft: pack.data?.output ?? null });
}

export async function POST(request:Request) {
  if(!cvSameOrigin(request))return cvError("unauthorized",403);
  const session=await cvSession();
  if(!session)return cvError("unauthorized",401);
  const op=mutations.safeParse(await readCvJson(request));
  if(!op.success)return cvError("invalid",400);
  if(!readEnv().SUPABASE_SERVICE_ROLE_KEY)return cvError("unavailable",503);
  if(!await allowAuthAttempt("application",session.id))return cvError("limited",429);
  const db=serviceSupabase(), input=op.data;
  try {
    if(input.operation==="analyze") {
      if(!llmConfig().success)return cvError("unavailable",503);
      const {data:draft}=await session.db.from("profiles").select("data").eq("user_id",session.id).maybeSingle();
      const p=profileSchema.safeParse(draft?.data);
      if(!p.success||!p.data.name)return cvError("profileRequired",409);
      const sanitized=stripContact(input.text,p.data);
      const report=await jsonCompletion(session.id,"analysis",analysisPrompt,{document:sanitized},reportSchema);
      const grounded=groundReport(report,sanitized);

      const inserted=await db.from("job_matches").insert({user_id:session.id,profile:p.data,report:grounded}).select("id").single();
      if(inserted.error)return cvError("unavailable",503);
      return cvJson({id:inserted.data.id,report:grounded,matches:reportMatches(grounded,p.data)});
    }
    const stored=await db.from("job_matches").select("profile,report").eq("id",input.id).eq("user_id",session.id).maybeSingle();
    if(!stored.data)return cvError("notFound",404);
    if(input.operation==="edit") {
      const result=await db.rpc("edit_application_letter",{p_user:session.id,p_job:input.id,p_cover:input.cover});
      return result.data===true?cvJson({saved:true}):cvError("conflict",409);
    }
    if(!llmConfig().success)return cvError("unavailable",503);
    const profile=profileSchema.parse(stored.data.profile), report=reportSchema.parse(stored.data.report);
    const started=await db.rpc("start_application",{p_user:session.id,p_job:input.id,p_request:input.request,p_regenerate:input.regenerate});
    if(started.error)return cvError("unavailable",503);
    const state=z.object({state:z.enum(["started","running","succeeded","failed","conflict","notFound","noCredits","regenerationLimit"]),
      run:z.uuid().optional(),output:z.unknown().optional()}).parse(started.data);
    if(state.state==="succeeded")return cvJson(state.output);
    if(state.state!=="started")return cvError(state.state,state.state==="noCredits"?402:409);
    const finish=(value:unknown)=>db.rpc("finish_application",{p_user:session.id,p_job:input.id,p_request:input.request,p_output:value});
    try {
      const letter = input.focus === "letter";
      const selection=await jsonCompletion(session.id,letter ? "cover-letter" : "tailoring",letter ? letterPrompt : tailoringPrompt,{
        job:{role:stripContact(report.position,profile),required:report.required.map(x=>stripContact(x,profile))},
        skills:letter ? [] : profile.skills.map((text,index)=>({index,text:stripContact(text,profile)})),
        experience:applicationEvidence(profile,input.focus).map((text,index)=>({index,text:stripContact(text,profile).slice(0,500)})),
      },selectionSchema,state.run);
      const result={...buildApplication(profile,report,letter ? { ...selection, skills:[], experience:[] } : selection,input.language,input.focus),language:input.language};
      if((await finish(result)).error)throw new Error("Application could not be persisted");
      return cvJson(result);
    }catch(error){
      if((await finish(null)).error)console.warn("[jobvion] Application reversal pending maintenance");
      return cvError(error instanceof BudgetLimit?"budget":"generationFailed",503);
    }
  }catch(error){return cvError(error instanceof BudgetLimit?"budget":"unavailable",503);}
}
