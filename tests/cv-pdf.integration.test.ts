import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generateCvPdf } from "@/lib/cv/pdf";
import { emptyEntry, initialProfile, type Profile } from "@/lib/cv/model";
import { getTemplate } from "@/lib/cv/templates";
import type { Locale } from "@/i18n/config";
import labels from "@/messages/cv.json";

vi.mock("server-only", () => ({}));

const python = process.env.JOBVION_PDF_TEST_PYTHON;
const active = Boolean(python && process.env.PDF_RENDERER_URL && process.env.PDF_RENDERER_TOKEN);

const samples = {
  tr: { name: "İpek Çağrı Şen", title: "Yazılım Mühendisi", detail: "Öğrenme araçlarının ölçüm ve erişilebilirlik süreçlerini geliştirdi." },
  de: { name: "Jörg Weiß", title: "Softwareentwickler", detail: "Verbesserte die Übersicht und prüfte die Zuverlässigkeit im täglichen Betrieb." },
};

function longProfile(language: keyof typeof samples): Profile {
  const sample = samples[language];
  return {
    ...initialProfile,
    name: sample.name, title: sample.title, email: "synthetic@example.test",
    summary: sample.detail.repeat(7),
    skills: ["TypeScript", "PostgreSQL", "Chromium"],
    experience: Array.from({ length: 11 }, (_, index) => ({
      ...emptyEntry, title: sample.title + " " + (index + 1), organization: "Example " + (index + 1),
      detail: (sample.detail + " ").repeat(9).trim(), start: "2019-01", end: "2022-09",
    })),
    education: [{ ...emptyEntry, title: language === "tr" ? "Bilgisayar Mühendisliği" : "Abschluss in Informatik" }],
    certificates: [{ ...emptyEntry, title: "Quality Assurance" }],
    languages: [{ ...emptyEntry, title: language === "tr" ? "Türkçe" : "Deutsch" }],
  };
}

const inspect = `
import json, sys
from pypdf import PdfReader
p = PdfReader(sys.argv[1])
print(json.dumps({
 "pages": len(p.pages),
 "text": "\\n".join(x.extract_text() for x in p.pages),
 "width": round(float(p.pages[0].mediabox.width)),
 "images": sum(len(x.images) for x in p.pages)
}))
`;

async function pdfData(language: Locale, id: string, profile: Profile, photo?: string, letter = false) {
  const bytes = await generateCvPdf(profile, {
    template: id, language, paper: letter ? "Letter" : "A4", photo: Boolean(photo),
  }, getTemplate(id)!, photo);
  expect(bytes).not.toBeNull();
  if (process.env.JOBVION_PDF_ARTIFACT_DIR) {
    const directory = process.env.JOBVION_PDF_ARTIFACT_DIR;
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, language + "-" + id + (photo ? "-photo" : "") + ".pdf"), bytes!);
  }
  const folder = await mkdtemp(join(tmpdir(),"jobvion-cv-test-"));
  const file = join(folder, "cv.pdf");
  await writeFile(file, bytes!);
  try {
    const result = JSON.parse(execFileSync(python!, ["-c", inspect, file], { encoding: "utf8" }));
    return result as { pages: number; width: number; text: string; images: number };
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

describe.runIf(active)("isolated CV renderer", () => {
  for (const [language, id] of [["tr", "essential"], ["de", "executive"], ["tr", "compact"]] as const) {
    it(`renders searchable, ordered ${language} text in ${id} across multiple pages`, async () => {
      const profile = longProfile(language);
      const result = await pdfData(language, id, profile, undefined, language === "de");
      expect(result.pages).toBeGreaterThan(1);
      expect(result.width).toBe(language === "de" ? 612 : 595);
      expect(result.text.normalize("NFC")).toContain(profile.name);
      expect(result.text.normalize("NFC")).toContain(profile.education[0].title);
      const content = result.text.toLocaleLowerCase(language);
      const order = ["summary","experience","education","skills","certificates","languages"] as const;
      const positions = order.map((heading) => content.indexOf(labels[language][heading].toLocaleLowerCase(language)));
      expect(positions.every((position, index) => position >= 0 && (index === 0 || position > positions[index - 1]))).toBe(true);
      expect(result.images).toBe(0);
    }, 35_000);
  }

  it("includes a normalized JPEG only when the photo is selected", async () => {
    const jpeg = await sharp({ create: { width: 160, height: 200, channels: 3, background: "teal" } }).jpeg().toBuffer();
    const profile = { ...initialProfile, name: "Photo Fixture", summary: "A synthetic resume.", skills: ["Editing"] };
    expect((await pdfData("en", "atlas", profile, "data:image/jpeg;base64," + jpeg.toString("base64"))).images).toBeGreaterThan(0);
    expect((await pdfData("en", "atlas", profile)).images).toBe(0);
  }, 35_000);
});
