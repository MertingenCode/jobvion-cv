"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { cvPost } from "@/lib/cv/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { policyVersion } from "@/lib/privacy/policies";
import type { Locale } from "@/i18n/config";
import Link from "next/link";

export function AccountControls({locale,accepted,deleteAt}:{locale:Locale;accepted:boolean;deleteAt:string|null}){
  const t=useTranslations("release"),router=useRouter(),[confirm,setConfirm]=useState(""),[busy,setBusy]=useState(false),
    [checked,setChecked]=useState(false),[notice,setNotice]=useState<"saved"|"unavailable"|null>(null);
  async function run(operation:"accept"|"cancel"|"delete"|"export",format?:"json"|"zip"){
    setBusy(true);setNotice(null);
    const payload=operation==="accept"?{operation,locale,version:policyVersion,terms:checked}:operation==="delete"?{operation,confirmation:confirm}:
      operation==="export"?{operation,format}:{operation};
    try{
      const response=await cvPost("/api/account",payload);
      if(!response.ok)throw new Error();
      if(operation==="export"){
        const href=URL.createObjectURL(await response.blob()),link=document.createElement("a");
        link.href=href;link.download="Jobvion-data."+format;link.click();
        setTimeout(()=>URL.revokeObjectURL(href),25000);
      }else{setNotice("saved");setConfirm("");router.refresh();}
    }catch{setNotice("unavailable");}finally{setBusy(false);}
  }
  return <div className="release-stack">
    <div className="cv-toolbar"><Link className="blog-link" href={`/${locale}/legal/terms`}>{t("terms")}</Link>
      <Link className="blog-link" href={`/${locale}/legal/privacy`}>{t("privacy")}</Link></div>
    {!accepted&&<div className="release-stack">
      <p>{t("consentNotice")}</p>
      <label className="cv-check"><input type="checkbox" checked={checked} onChange={(event)=>setChecked(event.target.checked)}/>{t("accept")}</label>
      <Button type="button" disabled={busy||!checked} onClick={()=>void run("accept")}>{t("accept")}</Button>
    </div>}
    <div className="cv-toolbar">
      <Button type="button" disabled={busy} onClick={()=>void run("export","json")}>{t("exportJson")}</Button>
      <Button type="button" disabled={busy} variant="outline" onClick={()=>void run("export","zip")}>{t("exportZip")}</Button>
    </div>
    <div className="release-stack release-lined">
      {deleteAt?<><time dateTime={deleteAt}>{new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short",timeZone:"UTC"}).format(new Date(deleteAt))} UTC</time>
        <Button type="button" disabled={busy} variant="outline" onClick={()=>void run("cancel")}>{t("cancelDelete")}</Button></>:
      <><label htmlFor="delete-word">{t("confirmDelete")}</label><Input id="delete-word" value={confirm} autoComplete="off" maxLength={6} onChange={(event)=>setConfirm(event.target.value)}/>
        <Button type="button" disabled={busy||confirm!=="DELETE"} variant="outline" onClick={()=>void run("delete")}>{t("deletion")}</Button></>}
    </div>
    {notice&&<p role="status">{t(notice)}</p>}
  </div>;
}
