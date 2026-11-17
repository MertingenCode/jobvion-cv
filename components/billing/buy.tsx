"use client";
import {useRouter} from "next/navigation";
import {useState} from "react";
import {useTranslations} from "next-intl";
import type { Locale } from "@/i18n/config";
import { Button } from "@/components/ui/button";
import { cvPost } from "@/lib/cv/client";
import { creditOffers } from "@/lib/billing/catalog";

export function BuyCredits({locale,pack}:{locale:Locale;pack:(typeof creditOffers)[number]["id"]}){
  const router=useRouter();
  const t=useTranslations("release"),[busy,setBusy]=useState(false),[failed,setFailed]=useState(false);
  async function buy(){
    setBusy(true);setFailed(false);
    try{
      const result=await cvPost("/api/billing/checkout",{locale,pack});
      if(result.status===401){router.push("/"+locale+"/login");return;}
      if(!result.ok)throw new Error();
      const value=await result.json();
      if(typeof value.location!=="string"||!value.location.startsWith("/"+locale+"/checkout?_ptxn=txn_"))throw new Error();
      router.push(value.location);
    }catch{setFailed(true);}finally{setBusy(false);}
  }
  return <div className="release-stack"><Button type="button" onClick={()=>void buy()} disabled={busy}>{t("buy")}</Button>
    {failed&&<p className="form-error" role="status">{t("unavailable")}</p>}</div>;
}
