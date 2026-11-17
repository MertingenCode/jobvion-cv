"use client";

import { useRef, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { localeNames, locales, type Locale } from "@/i18n/config";
import { getTemplate, templates, type Template } from "@/lib/cv/templates";
import { cvLocale, paperSizes, photoMaxBytes, type Profile } from "@/lib/cv/model";
import { cvPost, downloadCv, responseError, type CvErrorCode } from "@/lib/cv/client";
import { CvPaper, CvPaperStyles } from "@/components/cv/paper";
import { CvImport } from "@/components/cv/import";
import { CvScore } from "@/components/cv/score";
import { scoreProfile } from "@/lib/cv/check";
import { ProfileForm } from "@/components/cv/profile-form";
import { TemplateGallery } from "@/components/cv/gallery";
import { useProfileDraft } from "@/components/cv/draft";
import { useCvChoice } from "@/components/cv/choice";
import type { SavedCard } from "@/lib/cv/data";

type EditorProps = {
  locale: Locale;
  openImport?: boolean;
  detached?: boolean;
  owner: string;
  profile: Profile;
  revision: number;
  premium: boolean;
  photoVersion: string | null;
  cards: SavedCard[];
};

export function CvEditor(props: EditorProps) {
  const t = useTranslations("cv");
  const router = useRouter();
  const landing = useTranslations("landing");
  const draft = useProfileDraft(props.profile, props.revision, Boolean(props.detached));
  const [choice, setChoice] = useCvChoice(props.locale, props.owner);
  const [formVersion, setFormVersion] = useState(0);
  const [photoVersion, setPhotoVersion] = useState(props.photoVersion);
  const [message, setMessage] = useState<CvErrorCode | "photoReady" | "savedTitle" | null>(null);
  const [busy, setBusy] = useState(false);
  const retrySave = useRef<{ payload: string; id: string } | null>(null);
  const template = getTemplate(choice.template) ?? templates[0];
  const locked = template.tier === "premium" && !props.premium;
  const resolvedChoice = { ...choice, photo: choice.photo && template.supports_photo && Boolean(photoVersion) };
  const photo = photoVersion ? "/api/cv/photo?v=" + encodeURIComponent(photoVersion) : undefined;
  const ready = Boolean(draft.profile.name.trim()) && !locked;

  function selectTemplate(next: Template) {
    setChoice((current) => ({ ...current, template: next.id, photo: current.photo && next.supports_photo }));
    setMessage(null);
  }

  async function managePhoto(event?: ChangeEvent<HTMLInputElement>) {
    const file = event?.currentTarget.files?.[0];
    if (event) {
      event.currentTarget.value = "";
      if (!file) return;
    }
    if (file && (file.size > photoMaxBytes || !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setMessage("photoInvalid");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/cv/photo", file ? {
        method: "POST", body: file, headers: { "Content-Type": file.type },
      } : { method: "DELETE" });
      if (!response.ok) return setMessage(await responseError(response));
      const result = await response.json() as { version: string | null };
      setPhotoVersion(result.version);
      if (result.version) setMessage("photoReady");
      else setChoice((current) => ({ ...current, photo: false }));
    } catch {
      setMessage("unavailable");
    } finally {
      setBusy(false);
    }
  }

  async function submit(save: boolean) {
    if (!ready || busy) return;
    setBusy(true);
    setMessage(null);
    const input = { profile: draft.profile, choice: resolvedChoice };
    try {
      if (!save) return setMessage(await downloadCv(input));
      const serialized = JSON.stringify(input);
      if (retrySave.current?.payload !== serialized) retrySave.current = { payload: serialized, id: crypto.randomUUID() };
      const result = await cvPost("/api/cv", { operation: "save", id: retrySave.current.id, ...input });
      if (!result.ok) return setMessage(await responseError(result));
      retrySave.current = null;
      draft.recordSnapshot(input.profile);
      setMessage("savedTitle");
      router.refresh();
    } catch {
      setMessage("unavailable");
    } finally {
      setBusy(false);
    }
  }

  const date = new Intl.DateTimeFormat(props.locale, { dateStyle: "medium" });
  const pending = draft.status === "saving" || draft.status === "waiting";
  return <>
    <CvPaperStyles />
    <div className="cv-editor-grid">
      <section className="cv-editor-form">
        <div className="cv-toolbar cv-heading-row">
          <h2>{t("profile")}</h2>
          <span className="cv-muted" role="status">{t(draft.status)}</span>
          {!props.detached && !pending && draft.status !== "saved" && draft.status !== "conflict" &&
            <Button type="button" variant="quiet" onClick={() => void draft.flush()}>{t("retry")}</Button>}
        </div>
        {props.detached && <p className="cv-muted">{landing("scratchNote")}</p>}
        <CvImport locale={props.locale} open={Boolean(props.openImport)} apply={(profile) => { draft.update(profile); setFormVersion((value) => value + 1); }} hasProfile={(!props.detached && props.revision > 0) || Boolean(draft.profile.name || draft.profile.summary || draft.profile.email)} />
        <ProfileForm key={formVersion} profile={draft.profile} update={draft.update} />
      </section>
      <section className="cv-editor-preview">
        <h2>{t("preview")}</h2>
        <div className="editor-score"><CvScore result={scoreProfile(draft.profile, template, resolvedChoice.photo)} note={landing("scoreLimit")} /></div>
        <div className="cv-fields">
          <div className="cv-field-grid">
            <div className="field"><label htmlFor="cv-template">{t("templates")}</label>
              <select className="input" id="cv-template" value={template.id} onChange={(event) => {
                const selected = getTemplate(event.target.value);
                if (selected) selectTemplate(selected);
              }}>{templates.map((item) => <option value={item.id} key={item.id}>{item.name} ({t(item.tier)})</option>)}</select>
            </div>
            <div className="field"><label htmlFor="cv-language">{t("language")}</label>
              <select className="input" id="cv-language" value={choice.language} onChange={(event) => {
                const selected = cvLocale.safeParse(event.target.value);
                if (selected.success) setChoice({ ...choice, language: selected.data });
              }}>{locales.map((locale) => <option value={locale} key={locale} lang={locale}>{localeNames[locale]}</option>)}</select>
            </div>
            <div className="field"><label htmlFor="cv-page-size">{t("paper")}</label>
              <select className="input" id="cv-page-size" value={choice.paper} onChange={(event) =>
                setChoice({ ...choice, paper: event.target.value === "Letter" ? "Letter" : "A4" })}>
                {paperSizes.map((paper) => <option value={paper} key={paper}>{paper}</option>)}
              </select>
            </div>
          </div>
          <div className="cv-toolbar">
            <span className="cv-tag">{t(template.tier)}</span>
            <span className={template.ats_safe ? "cv-tag cv-ats-tag" : "cv-tag cv-design-tag"}>{t(template.ats_safe ? "ats" : "design")}</span>
          </div>
          {template.supports_photo && <div className="cv-photo-controls">
            <div className="field">
              <label htmlFor="cv-photo-upload">{t("editPhoto")}</label>
              <Input id="cv-photo-upload" className="cv-file-input" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy}
                aria-describedby="cv-photo-hint" onChange={(event) => void managePhoto(event)} />
              <p className="cv-muted" id="cv-photo-hint">{t("photoHint")}</p>
            </div>
            {photoVersion && <div className="cv-toolbar">
              <label className="cv-check"><input type="checkbox" checked={choice.photo}
                onChange={(event) => setChoice({ ...choice, photo: event.target.checked })} />{t("enablePhoto")}</label>
              <Button type="button" variant="quiet" disabled={busy} onClick={() => void managePhoto()}>{t("removePhoto")}</Button>
            </div>}
          </div>}
          {locked ? <p className="cv-muted" role="status">{t("locked")}</p> : !ready && <p className="cv-muted">{t("requiresName")}</p>}
          {message && <p role="status" className={message === "photoReady" || message === "savedTitle" ? "form-success" : "form-error"}>{t(message)}</p>}
          <div className="cv-toolbar">
            <Button type="button" disabled={!ready || busy} onClick={() => void submit(false)}>{t("download")}</Button>
            <Button type="button" variant="outline" disabled={!ready || busy} onClick={() => void submit(true)}>{t("newDocument")}</Button>
          </div>
          <CvPaper profile={draft.profile} choice={resolvedChoice} template={template} photo={photo} />
        </div>
      </section>
    </div>
    <TemplateGallery choice={choice} select={selectTemplate} />
    <section className="cv-saved">
      <h2>{t("myDocuments")}</h2>
      {props.cards.length ? <ul>
        {props.cards.map((card) => <li key={card.id}>
          <Link href={`/${props.locale}/app/cv/${card.id}`}>{card.title || t("draft")}</Link>
          <span>{getTemplate(card.template)?.name ?? card.template} · {date.format(new Date(card.created_at))}</span>
        </li>)}
      </ul> : <p>{t("none")}</p>}
    </section>
  </>;
}
