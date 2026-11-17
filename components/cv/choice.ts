"use client";

import { useState, useSyncExternalStore } from "react";
import { cvChoice, type CvChoice } from "@/lib/cv/model";
import { freeTemplateIds, getTemplate } from "@/lib/cv/templates";
import type { Locale } from "@/i18n/config";

const noUpdates = () => () => {};
const serverPreference = () => null;

export function useCvChoice(locale: Locale, owner: string) {
  const key = "jobvion-cv-preferences-" + owner;
  const [local, setLocal] = useState<CvChoice | null>(null);
  const cache = useSyncExternalStore(noUpdates, () => {
    try { return window.sessionStorage.getItem(key); } catch { return null; }
  }, serverPreference);
  let initial: CvChoice = { template: freeTemplateIds[0], language: locale, paper: "A4", photo: false };
  if (cache) {
    try {
      const saved = cvChoice.safeParse(JSON.parse(cache));
      if (saved.success && getTemplate(saved.data.template)) initial = saved.data;
    } catch {}
  }
  const choice = local ?? initial;
  function setChoice(patch: CvChoice | ((previous: CvChoice) => CvChoice)) {
    const next = typeof patch === "function" ? patch(choice) : patch;
    setLocal(next);
    try { window.sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
  }
  return [choice, setChoice] as const;
}
