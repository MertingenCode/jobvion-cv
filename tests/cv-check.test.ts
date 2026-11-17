import { expect, it } from "vitest";
import { scoreProfile, scoreText, importCvText } from "@/lib/cv/check";
import { sampleProfile } from "@/lib/cv/sample";
import { getTemplate } from "@/lib/cv/templates";
import { locales } from "@/i18n/config";
import { guides, localizedGuide } from "@/lib/content/guide";
import { starterPosts } from "@/lib/content/blog-starter";
import { blogPost } from "@/lib/blog/schema";
import { entryPath, selectDestination, workspacePath } from "@/lib/auth/destination";

it("uses the text to calculate five independently inspectable checks", () => {
  const resume = "Deniz Kaya\nÜrün Tasarımcısı\n+90 555 100 2000\nİŞ DENEYİMİ\nStudio North / 2022\nBECERİLER\nFigma, HTML";
  expect(scoreText(resume, "tr").score).toBe(100);
  expect(scoreText("Deniz Kaya", "tr").score).toBe(0);
  const profile = sampleProfile("tr");
  expect(scoreProfile(profile, getTemplate("essential")!, false).score).toBe(100);
  expect(scoreProfile(profile, getTemplate("atlas")!, false).checks.readability).toBe(false);
});

it("imports recognized text into editable fields while preserving pasted experience evidence", () => {
  const value = "Deniz Kaya\nUI Designer\ndeniz@example.com\n+90 555 000 9900\nİş deneyimi:\nNorth Studio\nRedesigned the editor\nBeceriler\nFigma; CSS";
  const profile = importCvText(value, "tr");
  expect(profile.name).toBe("Deniz Kaya");
  expect(profile.email).toBe("deniz@example.com");
  expect(profile.phone).toBe("+90 555 000 9900");
  expect(profile.experience[0].detail).toContain("Redesigned the editor");
  expect(profile.skills).toEqual(["Figma", "CSS"]);
});

it("ships a real localized body for each guide and blog locale", () => {
  for (const locale of locales) {
    for (const { slug } of guides) expect(localizedGuide(locale, slug)?.every(Boolean)).toBe(true);
    const posts = starterPosts(locale);
    expect(posts.length).toBeGreaterThan(1);
    for (const post of posts) expect(blogPost.parse(post).locale).toBe(locale);
  }
});

it("keeps onboarding destinations on local workspace routes", () => {
  expect(selectDestination("//example.com")).toBeUndefined();
  expect(selectDestination("constructor")).toBeUndefined();
  expect(entryPath("tr", false, "import")).toBe("/tr/signup?next=import");
  expect(workspacePath("tr", "import")).toBe("/tr/app/cv?mode=import");
});
