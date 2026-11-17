import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { freeTemplateIds, getTemplate, templates } from "@/lib/cv/templates";
import { initialProfile } from "@/lib/cv/model";
import { renderCv } from "@/lib/cv/document";
import { normalizePortrait } from "@/lib/cv/photo";
import cv from "@/messages/cv.json";

describe("CV templates and assets", () => {
  it("has 30 distinct layouts or typesetting styles and exactly three free ATS templates", () => {
    expect(templates).toHaveLength(30);
    expect(new Set(templates.map((item) => [item.layout,item.heading,item.header,item.typography].join("/"))).size).toBe(30);
    expect(templates.filter((item) => item.tier === "free").map((item) => item.id)).toEqual([...freeTemplateIds]);
    expect(templates.filter((item) => item.tier === "free").every((item) => item.ats_safe && item.columns === 1 && !item.supports_photo)).toBe(true);
    for (const dictionary of Object.values(cv)) expect(Object.keys(dictionary)).toEqual(Object.keys(cv.en));
  });

  it("escapes user text and reflows a photo-enabled template when the portrait is off", () => {
    const template = getTemplate("atlas")!;
    const profile = { ...initialProfile, name: "<b>İpek</b>", summary: "<img src=x onerror=alert(1)>" };
    const choice = { template: "atlas", language: "tr", paper: "A4", photo: true } as const;
    const html = renderCv(profile, choice, template, "/api/cv/photo?v=2026-11-17T20%3A10%3A00Z");
    expect(html).toContain("cv-photo-header");
    expect(html).toContain("&lt;b&gt;İpek&lt;/b&gt;");
    expect(html).toContain("&lt;img");
    expect(renderCv(profile, { ...choice, photo: false }, template, "/api/cv/photo")).not.toContain("cv-photo-header");
    const refused = renderCv(profile, choice, template, 'https://example.com/x.jpg" onerror="alert(1)');
    expect(refused).not.toContain("<img");
  });

  it("accepts matching raster type and strips embedded metadata while resizing", async () => {
    const fixture = await sharp({ create: { width: 900, height: 900, channels: 3, background: "linen" } })
      .withMetadata({ orientation: 6 }).jpeg().toBuffer();
    expect(await normalizePortrait(fixture, "image/png")).toBeNull();
    expect(await normalizePortrait(Buffer.from("<svg/>"), "image/svg+xml")).toBeNull();
    const normalized = await normalizePortrait(fixture, "image/jpeg");
    expect(normalized).not.toBeNull();
    const metadata = await sharp(normalized!).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.width).toBeLessThanOrEqual(600);
    expect(metadata.height).toBeLessThanOrEqual(720);
    expect(metadata.exif).toBeUndefined();
  });
});
