"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CvPaper, CvPaperStyles } from "@/components/cv/paper";
import { cvPost, downloadCv, responseError, type CvErrorCode } from "@/lib/cv/client";
import { getTemplate } from "@/lib/cv/templates";
import type { SavedCv } from "@/lib/cv/data";
import type { Locale } from "@/i18n/config";

export function SavedDocument({ item, locale, locked, photo }: {
  item: SavedCv; locale: Locale; locked: boolean; photo?: string;
}) {
  const t = useTranslations("cv");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<CvErrorCode | null>(null);
  const template = getTemplate(item.template);

  async function act(remove: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      if (!remove) return setMessage(await downloadCv({ id: item.id }));
      const result = await cvPost("/api/cv", { operation: "delete", id: item.id });
      if (!result.ok) return setMessage(await responseError(result));
      router.push(`/${locale}/app/cv`);
    } catch {
      setMessage("unavailable");
    } finally {
      setBusy(false);
    }
  }

  return template ? <div className="cv-preview-saved">
    <CvPaperStyles />
    <div className="cv-toolbar">
      <span className="cv-tag">{template.name}</span>
      <Button type="button" disabled={locked || busy} onClick={() => void act(false)}>{t("download")}</Button>
      <Button type="button" variant="quiet" disabled={busy} onClick={() => setConfirmDelete(!confirmDelete)} aria-expanded={confirmDelete}>
        {t("delete")}
      </Button>
    </div>
    {confirmDelete && <div className="cv-toolbar">
      <p>{t("deleteConfirm")}</p><Button type="button" variant="outline" disabled={busy} onClick={() => void act(true)}>{t("delete")}</Button>
    </div>}
    {locked && <p className="cv-muted">{t("locked")}</p>}
    {message && <p className="form-error" role="status">{t(message)}</p>}
    <CvPaper profile={item.profile_snapshot} choice={{
      template: item.template, language: item.cv_language, paper: item.paper, photo: item.photo_enabled,
    }} template={template} photo={photo} />
  </div> : <p>{t("notFound")}</p>;
}
