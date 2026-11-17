import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readEnv } from "@/lib/env";
import { renderCv } from "@/lib/cv/document";
import { readBytes } from "@/lib/cv/http";
import { cvFontFace, cvFontPath, cvStyles } from "@/lib/cv/styles";
import type { CvChoice, Profile } from "@/lib/cv/model";
import type { Template } from "@/lib/cv/templates";

let fontCss: Promise<string> | undefined;
function embeddedFonts() {
  return fontCss ??= readFile(join(process.cwd(), "public", cvFontPath.slice(1)))
    .then((font) => cvFontFace("data:font/woff2;base64," + font.toString("base64")));
}

export async function generateCvPdf(profile: Profile, choice: CvChoice, template: Template, photo?: string) {
  const env = readEnv();
  if (!env.PDF_RENDERER_URL || !env.PDF_RENDERER_TOKEN) return null;
  const body = renderCv(profile, choice, template, photo);
  const margins = "15mm 16mm";
  const html = `<!doctype html><html lang="${choice.language}"><head><meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
  <title>Jobvion CV</title><style>${await embeddedFonts()}${cvStyles}
  @page { size: ${choice.paper}; margin: ${margins}; }
  html,body { margin: 0; background: #fff; }
  @media print { .cv-sheet { width: auto; min-height: 0; padding: 0; print-color-adjust: exact; } }
  </style></head><body>${body}</body></html>`;
  const result = await fetch(new URL("/render", env.PDF_RENDERER_URL), {
    method: "POST", redirect: "error", cache: "no-store",
    headers: { "Content-Type": "text/html; charset=utf-8", Authorization: "Bearer " + env.PDF_RENDERER_TOKEN },
    body: html, signal: AbortSignal.timeout(18_000),
  });
  if (!result.ok || !result.headers.get("content-type")?.startsWith("application/pdf")) return null;
  if (Number(result.headers.get("content-length")) > 8 * 1024 * 1024) {
    await result.body?.cancel();
    return null;
  }
  const bytes = await readBytes(result, 8 * 1024 * 1024);
  return Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-" ? bytes : null;
}
