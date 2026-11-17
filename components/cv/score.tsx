"use client";

import { useState } from "react";
import { Check, Minus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { checkIds, scoreText } from "@/lib/cv/check";
import type { Locale } from "@/i18n/config";

type Result = ReturnType<typeof scoreText>;

export function CvScore({ result, note }: { result: Result; note?: string }) {
  const t = useTranslations("landing");
  return <div className="cv-score">
    <div className="cv-score-top"><span>{t("score")}</span><strong>{result.score}<small>/100</small></strong></div>
    <meter min={0} max={100} value={result.score} aria-label={t("score")} />
    <ul className="score-criteria">
      {checkIds.map((id) => <li key={id}>
        {result.checks[id] ? <Check size={17} aria-hidden="true" /> : <Minus size={17} aria-hidden="true" />}
        <span>{t(id)}</span><span>{t(result.checks[id] ? "passed" : "missing")}</span>
      </li>)}
    </ul>
    {note && <p className="score-note">{note}</p>}
  </div>;
}

export function PublicCvCheck({ locale, example }: { locale: Locale; example: string }) {
  const t = useTranslations("landing");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [sample, setSample] = useState(false);
  function useExample() {
    setInput(example);
    setResult(scoreText(example, locale));
    setSample(true);
  }
  return <div className="check-layout">
    <form className="check-form" onSubmit={(event) => {
      event.preventDefault();
      setResult(scoreText(input, locale));
    }}>
      <label htmlFor="ats-text">{t("pasteCv")}</label>
      <textarea className="input" id="ats-text" maxLength={16000} rows={8} value={input}
        onChange={(event) => { setInput(event.target.value); setSample(false); setResult(null); }} required />
      <div className="landing-actions">
        <Button type="submit" disabled={!input.trim()}>{t("runCheck")}</Button>
        <Button type="button" variant="outline" onClick={useExample}>{t("loadSample")}</Button>
      </div>
      <p className="score-note">{t("localCheck")}</p>
    </form>
    <div className="check-result" aria-live="polite">
      {result ? <CvScore result={result} note={sample ? t("sampleResult") : t("scoreLimit")} /> :
        <p>{t("resultReady")}</p>}
    </div>
  </div>;
}
