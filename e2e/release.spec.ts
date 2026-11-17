import { expect, test } from "@playwright/test";
import { locales } from "../i18n/config";

test("renders templates and public SEO in every locale", async ({ page, request }) => {
  await page.goto("/tr/templates");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("CV şablonları");
  await expect(page.locator(".gallery-grid > li")).toHaveCount(30);
  await page.getByRole("link", { name: /Essential/i }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Essential");
  await expect(page.locator(".gallery-detail")).toBeVisible();

  for (const locale of locales) {
    const response = await request.get("/" + locale + "/pricing");
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toContain('rel="canonical" href="http://localhost:3000/' + locale + '/pricing"');
    expect(html).toContain('hrefLang="x-default"');
  }
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/de/templates/essential");
  expect(sitemap).toContain("/tr/guides/write-a-short-cover-letter");
  expect(sitemap).not.toContain("/app/");
  const image = await request.get("/en/opengraph-image");
  expect(image.ok()).toBe(true);
  expect(image.headers()["content-type"]).toContain("image/png");
});

test("protects release endpoints and keeps draft covers private", async ({ request }) => {
  for (const path of ["/api/application","/api/account","/api/billing/checkout"])
    expect((await request.post(path,{data:{}})).status()).toBe(401);
  expect((await request.post("/api/admin/promotion",{data:{}})).status()).toBe(403);
  expect((await request.post("/api/internal/maintenance")).status()).toBe(403);
  expect((await request.get("/api/blog/cover/61cb1f43-a612-4235-9ac9-8622da9875e3")).status()).toBe(404);
});
