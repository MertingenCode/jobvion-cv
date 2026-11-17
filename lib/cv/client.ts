"use client";

let pendingDraft: (() => Promise<boolean>) | undefined;

export function listenForDraftSave(callback: () => Promise<boolean>) {
  pendingDraft = callback;
  return () => {
    if (pendingDraft === callback) pendingDraft = undefined;
  };
}

export async function saveBeforeLocaleChange() {
  return pendingDraft ? pendingDraft() : true;
}

const statuses = ["invalid", "unavailable", "locked", "conflict", "limited", "notFound", "unauthorized", "photoInvalid"] as const;
export type CvErrorCode = (typeof statuses)[number];

export async function responseError(response: Response): Promise<CvErrorCode> {
  const payload = await response.json().catch(() => null) as { error?: unknown } | null;
  return statuses.find((name) => name === payload?.error) ?? "unavailable";
}

export function cvPost(path: string, body: unknown) {
  return fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export async function downloadCv(payload: unknown): Promise<CvErrorCode | null> {
  try {
    const response = await cvPost("/api/cv/pdf", payload);
    if (!response.ok) return await responseError(response);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "Jobvion-CV.pdf";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return null;
  } catch {
    return "unavailable";
  }
}
