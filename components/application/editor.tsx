"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cvPost,downloadCv } from "@/lib/cv/client";
import { localeNames,locales,type Locale } from "@/i18n/config";
import type { Profile } from "@/lib/cv/model";
import type { ApplicationFocus, JobReport } from "@/lib/application/model";

type Analysis={id:string;report:JobReport;matches:{term:string;matched:boolean;level:string}[]};
type Draft={profile:Profile;cover:string;language:Locale;before?:{skills:string[];experience:Pick<Profile["experience"][number],"title"|"organization">[]}};
const failures=["limited","noCredits","budget","generationFailed","profileRequired","regenerationLimit","running","conflict","unavailable","invalid"] as const;

export function ApplicationEditor({locale,recent,focus}:{locale:Locale;focus:ApplicationFocus;recent:{id:string;title:string}[]}) {
  const t=useTranslations("release");
  const cv=useTranslations("cv");
  const authFlow = useTranslations("authFlow");
  const letterOnly = focus === "letter";
  const [text,changeText]=useState("");
  const [language,setLanguage]=useState(locale);
  const [history,setHistory]=useState(recent);
  const [analysis,setAnalysis]=useState<Analysis|null>(null);
  const [draft,setDraft]=useState<Draft|null>(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<typeof failures[number]|"saved"|null>(null);
  const [request,setRequest]=useState<{id:string;retry:boolean}|null>(null);

  async function open(id: string) {
    if (!id || busy) return;
    setBusy(true); setMessage(null);
    try {
      const response = await fetch("/api/application?id=" + encodeURIComponent(id));
      if (!response.ok) throw new Error();
      const saved = await response.json();
      setAnalysis(saved); setDraft(saved.draft); setRequest(null); changeText("");
      if (saved.draft) setLanguage(saved.draft.language);
    } catch {
      setMessage("unavailable");
    } finally {
      setBusy(false);
    }
  }

  async function action(kind:"analyze"|"generate"|"regenerate"|"letter"|"cv"|"pdf") {
    if(busy)return;
    setBusy(true);setMessage(null);
    try{
      if(kind==="pdf"&&draft){
        const failure=await downloadCv({profile:draft.profile,choice:{template:"essential",language:draft.language,paper:"A4",photo:false}});
        if(failure)setMessage("unavailable");
        return;
      }
      let response:Response;
      if(kind==="analyze"){
        response=await cvPost("/api/application",{operation:"analyze",text});
      }else if(kind==="generate"||kind==="regenerate"){
        if(!analysis)return;
        const regenerate=kind==="regenerate";
        const attempt=request?.retry===regenerate?request:{id:crypto.randomUUID(),retry:regenerate};
        setRequest(attempt);
        response=await cvPost("/api/application",{operation:"generate",id:analysis.id,request:attempt.id,regenerate,language,focus});
      }else{
        if(!draft||!analysis)return;
        response=kind==="letter"?await cvPost("/api/application",{operation:"edit",id:analysis.id,cover:draft.cover})
          :await cvPost("/api/cv",{operation:"save",id:crypto.randomUUID(),profile:draft.profile,
            choice:{template:"essential",language:draft.language,paper:"A4",photo:false}});
      }
      if(!response.ok){
        const data=await response.json().catch(()=>null);
        const failure=failures.find((error)=>error===data?.error)??"unavailable";
        setMessage(failure);
        if(failure!=="running"&&failure!=="unavailable")setRequest(null);
        return;
      }
      const data=await response.json();
      if(kind==="analyze"){
        setAnalysis(data);setDraft(null);
        setHistory((items) => [{id: data.id, title: data.report.position}, ...items].slice(0,25));
      }
      else if(kind==="generate"||kind==="regenerate"){setDraft(data);}
      else setMessage("saved");
      setRequest(null);
    }catch{setMessage("unavailable");}finally{setBusy(false);}
  }

  function downloadLetter() {
    if (!draft?.cover.trim()) return;
    const url = URL.createObjectURL(new Blob([draft.cover], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "Jobvion-cover-letter.txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="release-stack">
    <form className="release-stack" onSubmit={(event)=>{event.preventDefault();void action("analyze");}}>
      <label htmlFor="job-paste">{t("job")}</label>
      <textarea className="input" id="job-paste" rows={8} minLength={80} maxLength={16000} value={text}
        onChange={(event)=>{changeText(event.target.value);setAnalysis(null);setDraft(null);setRequest(null);}} required disabled={busy}/>
      <Button type="submit" disabled={busy||text.trim().length<80}>{t("analyze")}</Button>
    </form>
    {history.length > 0 && <label>
      {locale === "tr" ? "Kayıtlı ilan analizleri" : "Saved job analyses"}{" "}
      <select value={analysis?.id ?? ""} disabled={busy} onChange={(event) => void open(event.target.value)}>
        <option value="" disabled>{locale === "tr" ? "İlan seç" : "Select a posting"}</option>
        {history.map(({id,title}) => <option key={id} value={id}>{title}</option>)}
      </select>
    </label>}
    {analysis&&<section className="release-stack release-lined">
      <h2>{t("matches")}</h2><p>{analysis.report.position}{analysis.report.company?" · "+analysis.report.company:""}</p>
      <div className="release-grid">
        {[true,false].map((matched)=><div key={String(matched)}><h3>{t(matched?"matched":"missing")}</h3>
          <ul className="release-list">{analysis.matches.filter((item)=>item.matched===matched)
            .map((item)=><li key={item.term}>{item.term}</li>)}</ul>
        </div>)}
      </div>
      <label htmlFor="application-language">{t("language")}</label>
      <select className="input" id="application-language" value={language}
        onChange={(e)=>setLanguage(e.target.value as Locale)} disabled={busy}>
        {locales.map((code)=><option key={code} value={code}>{localeNames[code]}</option>)}
      </select>
      <p className="cv-muted">{t("requestCost")}</p>
      <Button type="button" onClick={()=>void action(draft?"regenerate":"generate")} disabled={busy}>
        {draft ? t("regenerate") : letterOnly ? authFlow("writeLetter") : t("generate")}
      </Button>
    </section>}
    {draft&&<section className="release-stack release-lined">
      {!letterOnly && <>
      <h2>{t("saveCv")}</h2>
      {draft.before && <details>
        <summary>{locale === "tr" ? "Profildeki önceki sıra" : "Original profile order"}</summary>
        <div className="release-grid">
          <div><h3>{cv("experience")}</h3>
            <ol>{draft.before.experience.map((item,index) => <li key={index}>{item.title} {item.organization}</li>)}</ol>
          </div>
          <div><h3>{cv("skills")}</h3><ol>{draft.before.skills.map((skill,index) => <li key={index}>{skill}</li>)}</ol></div>
        </div>
      </details>}
      <div className="release-grid">
        <div><h3>{cv("experience")}</h3><ol className="release-list">{draft.profile.experience.map((entry,i)=><li key={i}>{entry.title} {entry.organization}</li>)}</ol></div>
        <div><h3>{cv("skills")}</h3><ol className="release-list">{draft.profile.skills.map((skill,i)=><li key={i}>{skill}</li>)}</ol></div>
      </div>
      <label htmlFor="tailored-summary">{t("summary")}</label>
      <textarea className="input" id="tailored-summary" rows={4} maxLength={1800} value={draft.profile.summary}
        onChange={(e)=>setDraft({...draft,profile:{...draft.profile,summary:e.target.value}})}/>
      <div className="cv-toolbar">
        <Button type="button" onClick={()=>void action("cv")} disabled={busy}>{t("saveCv")}</Button>
        <Button type="button" onClick={()=>void action("pdf")} disabled={busy} variant="outline">{cv("download")}</Button>
      </div>
      </>}
      <label htmlFor="letter">{t("cover")}</label>
      <textarea className="input" id="letter" rows={10} maxLength={8000} value={draft.cover}
        onChange={(e)=>setDraft({...draft,cover:e.target.value})}/>
      <div className="cv-toolbar">
        <Button type="button" onClick={()=>void action("letter")} disabled={busy||!draft.cover.trim()}>{t("saveCover")}</Button>
        <Button type="button" variant="outline" onClick={downloadLetter} disabled={busy||!draft.cover.trim()}>{authFlow("exportLetter")}</Button>
      </div>
    </section>}
    {message&&<p role="status" className={message==="saved"?"form-success":"form-error"}>{message === "limited" ? cv("limited") : t(message)}</p>}
    {message==="profileRequired"&&<Link className="blog-link" href={`/${locale}/app/cv`}>{cv("editor")}</Link>}
  </div>;
}
