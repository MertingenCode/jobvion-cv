import "server-only";
import { z } from "zod";
import { serviceSupabase } from "@/lib/supabase/admin";

const numeric = z.coerce.number().positive().max(10000);
export const llmConfig = () => z.strictObject({
  url:z.url().refine((v)=>v.startsWith("https://")), key:z.string().min(1), model:z.string().min(1).max(100),
  input:numeric, output:numeric, cap:z.coerce.number().int().positive().max(2_000_000_000),
}).safeParse({url:process.env.LLM_BASE_URL,key:process.env.LLM_API_KEY,model:process.env.LLM_MODEL,
  input:process.env.LLM_INPUT_USD_PER_MILLION,output:process.env.LLM_OUTPUT_USD_PER_MILLION,cap:process.env.LLM_DAILY_CAP_MICRO_USD});

const chatResponse = z.object({
  choices:z.array(z.object({message:z.object({content:z.string().max(16000)}),finish_reason:z.literal("stop")})).min(1),
  usage:z.object({prompt_tokens:z.number().int().nonnegative(),completion_tokens:z.number().int().nonnegative()}),
});
export class BudgetLimit extends Error {}

export async function jsonCompletion<T>(user: string, step: string, prompt: string, untrusted: unknown, output: z.ZodType<T>, run?: string) {
  const config=llmConfig();
  if(!config.success) throw new Error("Language model unavailable.");
  const {url,key,model,input,output:rate,cap}=config.data;
  const db=serviceSupabase();
  const payload=JSON.stringify(untrusted);
  const maxTokens=1200;
  const request={model,max_tokens:maxTokens,response_format:{type:"json_object"},messages:[
    {role:"system",content:prompt},{role:"user",content:payload},
  ]};
  const reserve=Math.ceil((Buffer.byteLength(payload+prompt,"utf8")+768)*input+maxTokens*rate);
  for(let attempt=0;attempt<2;attempt++) {
    const budget=await db.rpc("reserve_llm_budget",{p_units:reserve,p_limit:cap});
    if(budget.error||budget.data!==true) {
      if(budget.data===false) console.warn("[jobvion] LLM daily budget reached");
      throw new BudgetLimit();
    }
    const start=Date.now();
    let usage:z.infer<typeof chatResponse>["usage"]|undefined;
    let succeeded=false;
    try {
      const response=await fetch(new URL(url.replace(/\/$/,"")+"/chat/completions"),{
        method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},
        signal:AbortSignal.timeout(12_000),redirect:"error",cache:"no-store",body:JSON.stringify(request),
      });
      if(!response.ok) throw new Error("Provider response failed.");
      const data=chatResponse.parse(await response.json());
      usage=data.usage;
      if(usage.prompt_tokens*input+usage.completion_tokens*rate>reserve) {
        console.warn("[jobvion] LLM usage exceeded the configured reserve");
        throw new Error("Provider usage exceeded reservation.");
      }
      const value=output.parse(JSON.parse(data.choices[0].message.content));
      succeeded=true;
      return value;
    } catch {
      if(attempt===1) throw new Error("Language model request failed.");
    } finally {
      const {error}=await db.from("llm_calls").insert({
        user_id:user,run_id:run??null,step,provider:"openai-compatible",model,succeeded,duration_ms:Date.now()-start,
        input_tokens:usage?.prompt_tokens??null,output_tokens:usage?.completion_tokens??null,
        cost_usd:usage?(usage.prompt_tokens*input+usage.completion_tokens*rate)/1_000_000:null,
      });
      if(error) console.warn("[jobvion] LLM usage log could not be recorded");
    }
  }
  throw new Error("Language model request failed.");
}
