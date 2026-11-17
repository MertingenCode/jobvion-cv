import { expect, test } from "@playwright/test";

test("admin and draft preview reject public visitors, including the unlocalized route", async ({ request }) => {
  for (const route of ["/admin", "/tr/admin/blog", "/en/admin/blog/8c6df99f-f3e7-4e96-8045-91bf4452ceec/preview"]) {
    const result = await request.get(route);
    expect(result.status()).toBe(403);
    expect(result.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  }
  const worker = await request.post("/api/internal/publish-blog");
  expect(worker.status()).toBe(403);
});

test("public blog displays localized articles and excludes drafts from search", async ({ page, request }) => {
  await page.goto("/tr/blog");
  await expect(page.getByRole("heading", { name: "Blog", exact: true })).toBeVisible();
  await expect(page.locator('a[href="/tr/blog/reuse-one-cv-profile"]')).toBeVisible();
  const draft = await request.get("/en/blog/ats-friendly-resume");
  expect(draft.status()).toBe(404);
  const sitemap = await request.get("/sitemap.xml");
  expect(await sitemap.text()).not.toContain("/admin");
  expect(await sitemap.text()).not.toContain("ats-friendly-resume");
});
