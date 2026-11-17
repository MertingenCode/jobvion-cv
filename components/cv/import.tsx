"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { importCvText } from "@/lib/cv/check";
import type { Profile } from "@/lib/cv/model";
import type { Locale } from "@/i18n/config";

export function CvImport({ locale, apply, hasProfile, open }: {
  locale: Locale; apply: (profile: Profile) => void; hasProfile: boolean; open: boolean;
}) {
  const t = useTranslations("landing");
  const cv = useTranslations("cv");
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<Profile | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [applied, setApplied] = useState(false);
  return <details className="cv-repeat editor-import" open={open || undefined}>
    <summary>{t("importTitle")}</summary>
    <div className="check-form">
      <p>{t("importHint")}</p>
      <label htmlFor="import-cv">{t("pasteCv")}</label>
      <textarea className="input" id="import-cv" rows={7} maxLength={16000} value={text}
        onChange={(event) => { setText(event.target.value); setPreview(null); setAccepted(false); setApplied(false); }} />
      <Button type="button" variant="outline" disabled={!text.trim()} onClick={() => setPreview(importCvText(text, locale))}>{t("reviewImport")}</Button>
      {preview && <div className="check-form">
        <p>{t("reviewDetails")}</p>
        <dl>
          <dt>{cv("name")}</dt><dd>{preview.name || "—"}</dd>
          <dt>{cv("summary")}</dt><dd>{preview.summary || "—"}</dd>
          <dt>{cv("skills")}</dt><dd>{preview.skills.join(", ") || "—"}</dd>
        </dl>
        {hasProfile && <label className="cv-check"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />{t("replaceProfile")}</label>}
        <Button type="button" disabled={hasProfile && !accepted} onClick={() => {
          apply(preview);
          setText(""); setPreview(null); setAccepted(false); setApplied(true);
        }}>{t("applyImport")}</Button>
      </div>}
      {applied && <p role="status">{t("reviewDetails")}</p>}
    </div>
  </details>;
}
