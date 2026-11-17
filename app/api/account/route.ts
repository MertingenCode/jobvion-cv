import { z } from "zod";
import { cvSession,userPhoto } from "@/lib/cv/data";
import { cvError,cvJson,cvSameOrigin,privateResponse,readCvJson } from "@/lib/cv/http";
import { cvLocale,profileSchema,type CvChoice,type Profile } from "@/lib/cv/model";
import { generateCvPdf } from "@/lib/cv/pdf";
import { getTemplate,type Template } from "@/lib/cv/templates";
import { serviceSupabase } from "@/lib/supabase/admin";
import { readEnv } from "@/lib/env";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { policyVersion } from "@/lib/privacy/policies";
import { createZip } from "@/lib/privacy/zip";

async function exportPdf(id: string, profile: Profile, choice: CvChoice, template: Template, photo: string | null) {
  const pdf = await generateCvPdf(profile,choice,template,choice.photo && photo ? "data:image/jpeg;base64," + photo : undefined);
  if (!pdf) throw new Error("PDF export failed.");
  return { name: id + ".pdf", content: pdf };
}

export const maxDuration=300;
const operations=z.discriminatedUnion("operation",[
  z.strictObject({operation:z.literal("accept"),locale:cvLocale,version:z.literal(policyVersion),terms:z.literal(true)}),
  z.strictObject({operation:z.literal("delete"),confirmation:z.literal("DELETE")}),
  z.strictObject({operation:z.literal("cancel")}),
  z.strictObject({operation:z.literal("export"),format:z.enum(["json","zip"])}),
]);

export async function POST(request:Request) {
  if(!cvSameOrigin(request))return cvError("unauthorized",403);
  const session=await cvSession();
  if(!session)return cvError("unauthorized",401);
  const op=operations.safeParse(await readCvJson(request));
  if(!op.success)return cvError("invalid",400);
  if(!readEnv().SUPABASE_SERVICE_ROLE_KEY)return cvError("unavailable",503);
  if(!await allowAuthAttempt("privacy",session.id))return cvError("limited",429);
  const {db,id}=session, service=serviceSupabase(), input=op.data;
  try{
    if(input.operation==="accept"){
      const {error}=await service.from("policy_acceptance").upsert({user_id:id,version:policyVersion,locale:input.locale},
        {onConflict:"user_id,version",ignoreDuplicates:true});
      return error?cvError("unavailable",503):cvJson({saved:true});
    }
    if(input.operation==="delete"){
      const {error}=await service.from("account_deletions").upsert({user_id:id},{onConflict:"user_id",ignoreDuplicates:true});
      return error?cvError("unavailable",503):cvJson({saved:true});
    }
    if(input.operation==="cancel"){
      const {data,error}=await service.from("account_deletions").delete().eq("user_id",id).is("claimed_until",null)
        .gt("due_at",new Date().toISOString()).select("user_id");
      return error?cvError("unavailable",503):data.length?cvJson({saved:true}):cvError("conflict",409);
    }

    const sorts: Record<string,string> = {
      profiles: "user_id", credit_accounts: "user_id", cv_template_entitlements: "user_id",
      account_deletions: "user_id", policy_acceptance: "version", application_attempts: "request_id",
    };
    const getAll=async(table:string,privileged=false)=>{
      const rows:Record<string,unknown>[]=[];
      for(let from=0;;from+=250) {
        const result=await (privileged?service:db).from(table).select("*").eq("user_id",id).order(sorts[table] ?? "id").range(from,from+249);
        if(result.error)throw new Error("Data export failed.");
        rows.push(...result.data);
        if(result.data.length<250)return rows;
        if(rows.length>=100_000)throw new Error("Export limit exceeded.");
      }
    };
    const regular=["profiles","cvs","credit_accounts","credit_ledger","purchases","generation_runs","promo_grants","policy_acceptance","account_deletions"];
    const internal=["job_matches","application_attempts","checkout_intents","llm_calls","cv_template_entitlements"];
    const [tables,privateRows,photo,identity]=await Promise.all([
      Promise.all(regular.map(async(table)=>[table,await getAll(table)] as const)),
      Promise.all(internal.map(async(table)=>[table,await getAll(table,true)] as const)),
      userPhoto(session), db.auth.getUser(),
    ]);
    if(photo.error||identity.error)throw new Error("Data export failed.");
    const matches=privateRows.find(([table])=>table==="job_matches")?.[1]??[];
    const packs=[];
    for(let offset=0;offset<matches.length;offset+=100){
      const {data,error}=await service.from("application_packs").select("*").in("job_id",matches.slice(offset,offset+100).map((row)=>row.id));
      if(error)throw new Error("Data export failed."); packs.push(...data);
    }
    const account=identity.data.user;
    const payload={exportedAt:new Date().toISOString(),account:{id,email:account?.email,createdAt:account?.created_at},
      data:Object.fromEntries([...tables,...privateRows]),applications:packs,
      photo:input.format==="json"?photo.photo?.jpeg_base64??null:photo.photo?"portrait.jpg":null};
    const json=Buffer.from(JSON.stringify(payload,null,2));
    if(input.format==="json")return new Response(new Uint8Array(json),{headers:{...privateResponse,"Content-Type":"application/json",
      "Content-Disposition":'attachment; filename="Jobvion-data.json"'}});
    const files=[{name:"account.json",content:new Uint8Array(json)}];
    if(photo.photo)files.push({name:"portrait.jpg",content:new Uint8Array(Buffer.from(photo.photo.jpeg_base64,"base64"))});
    const cvs=tables.find(([table])=>table==="cvs")?.[1]??[];
    for(const row of cvs) {
      const id=z.uuid().parse(row.id), profile=profileSchema.parse(row.profile_snapshot);
      const template=getTemplate(z.string().parse(row.template)); if(!template)throw new Error("Unknown CV template.");
      const choice={template:template.id,language:cvLocale.parse(row.cv_language),paper:z.enum(["A4","Letter"]).parse(row.paper),photo:row.photo_enabled===true};
      const permission=await db.rpc("can_use_cv_template",{p_template:choice.template,p_photo:choice.photo});
      if(permission.error)throw new Error("Template check failed.");
      if (permission.data !== true) {
        const fallback = getTemplate("essential");
        if (!fallback) throw new Error("Default CV template is missing.");
        files.push(await exportPdf(id,profile,{ ...choice, template:fallback.id, photo:false },fallback,null));
      }
      else files.push(await exportPdf(id, profile, choice, template, photo.photo?.jpeg_base64 ?? null));


    }
    const zip=createZip(files);
    return new Response(new Uint8Array(zip),{headers:{...privateResponse,"Content-Type":"application/zip",
      "Content-Disposition":'attachment; filename="Jobvion-data.zip"'}});
  }catch{return cvError("unavailable",503);}
}
