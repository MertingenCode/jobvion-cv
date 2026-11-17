import {createClient} from "@supabase/supabase-js";

async function main() {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const packages=[["starter",process.env.PADDLE_PRICE_STARTER],["standard",process.env.PADDLE_PRICE_STANDARD],["large",process.env.PADDLE_PRICE_LARGE]];
  if(!process.argv.includes("--confirm")||!url||!key||packages.some(([,price])=>!/^pri_[a-z\d]{26}$/.test(price??""))||
    new Set(packages.map(([,price])=>price)).size!==3)throw new Error("Configure the checkout price IDs and use --confirm.");
  const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
  const {data,error}=await db.from("credit_packages").select("id,paddle_price_id").in("id",packages.map(([id])=>id));
  if(error||data.length!==3)throw new Error("Apply the pending migrations first.");
  for(const [id,price] of packages) {
    const current=data.find((row)=>row.id===id).paddle_price_id;
    if(current&&current!==price)throw new Error("Existing price mapping differs. Reconcile historical prices before the change.");
  }
  for(const [id,price] of packages){
    if((await db.from("credit_packages").update({paddle_price_id:price}).eq("id",id)).error)throw new Error("Price mapping could not be written. The command is safe to retry.");
  }
  console.log("Paddle credit prices mapped.");
}
main().catch((e)=>{console.error(e.message);process.exitCode=1;});
