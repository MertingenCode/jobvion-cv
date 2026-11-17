import { expect, test } from "@playwright/test";
import { locales } from "../i18n/config";

test("renders template previews, single-page pricing, and localized content", async ({ page, request }) => {
  await page.goto("/tr/templates");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CV şablonları");
  await expect(page.locator(".gallery-grid > li")).toHaveCount(30);
  await page.getByRole("link", { name: /Essential/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Essential");
  await expect(page.locator(".gallery-detail .cv-preview-page")).toHaveCSS("transform-origin", "0px 0px");

  for (const locale of locales) {
    const pricing = await request.get("/" + locale + "/pricing", { maxRedirects: 0 });
    expect(pricing.status()).toBe(308);
    expect(pricing.headers().location).toContain("/" + locale + "#pricing");
    for (const route of ["/guides/write-a-short-cover-letter", "/blog/reuse-one-cv-profile"]) {
      const response = await request.get("/" + locale + route);
      expect(response.status()).toBe(200);
      const html = await response.text();
      expect(html).toContain('rel="canonical" href="http://localhost:3000/' + locale + route + '"');
      expect(html).toContain('hrefLang="x-default"');
      expect(html).toContain('<html lang="' + locale + '"');
    }
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/de/templates/essential");
  expect(sitemap).toContain("/nl/guides/write-a-short-cover-letter");
  expect(sitemap).toContain("/pt/blog/reuse-one-cv-profile");
  expect(sitemap).not.toContain("/app/");
  const image = await request.get("/en/opengraph-image");
  expect(image.headers()["content-type"]).toContain("image/png");
});

test("offers a real ATS example and routes start options to the appropriate signup", async ({ page, request }) => {
  await page.setViewportSize({ width: 360, height: 760 });
  await page.goto("/tr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Her ilana özel bir CV hazırla.");
  await expect(page.locator('select[name="locale"] option:checked')).toHaveText("TR");
  await expect(page.locator('#tools a[href="/tr/signup?next=import"]')).toHaveCount(1);
  await expect(page.locator('#tools a[href="/tr/signup?next=tailor"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(360);
  await page.getByRole("button", { name: "Örnek metni kullan" }).click();
  await expect(page.locator("#cv-check meter")).toHaveAttribute("value", "100");
  await page.getByLabel("CV metni").fill("Deniz Kaya");
  await page.getByRole("button", { name: "CV’yi kontrol et" }).click();
  await expect(page.locator("#cv-check meter")).toHaveAttribute("value", "0");
  await expect(page.locator("#pricing")).toContainText("15 kredi");
  const download = await request.get("/examples/jobvion-ats-cv.pdf");
  expect(download.headers()["content-type"]).toContain("application/pdf");
  await page.locator('#tools a[href="/tr/signup?next=import"]').click();
  await expect(page).toHaveURL(/\/tr\/signup\?next=import$/);
  await expect(page.locator('.auth-switch a')).toHaveAttribute("href", "/tr/login?next=import");
});

test("protects release endpoints and keeps draft covers private", async ({ request }) => {
  for (const path of ["/api/application", "/api/account", "/api/billing/checkout"])
    expect((await request.post(path, { data: {} })).status()).toBe(401);
  expect((await request.post("/api/admin/promotion", { data: {} })).status()).toBe(403);
  expect((await request.post("/api/internal/maintenance")).status()).toBe(403);
  expect((await request.get("/api/blog/cover/61cb1f43-a612-4235-9ac9-8622da9875e3")).status()).toBe(404);
});
