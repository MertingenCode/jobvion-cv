import { expect, test } from "@playwright/test";

test("uses a collapsible menu on phones and inline navigation on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/tr");
  const trigger = page.locator(".mobile-navigation summary");
  const mobileLinks = page.locator(".mobile-navigation-links");
  await expect(page.locator(".site-nav")).toBeHidden();
  await expect(trigger).toBeVisible();
  await expect(mobileLinks).toBeHidden();
  await trigger.click();
  await expect(mobileLinks.getByRole("link")).toHaveCount(6);
  const score = mobileLinks.getByRole("link", { name: "CV puanı" });
  await score.focus();
  await page.keyboard.press("Escape");
  await expect(mobileLinks).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await score.click();
  await expect(page).toHaveURL(/#cv-check$/);
  await expect(mobileLinks).toBeHidden();

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(trigger).toBeHidden();
  await expect(page.locator(".site-nav").getByRole("link", { name: "CV puanı" })).toBeVisible();
});

test("wraps blog languages and legal links into separate touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  for (const path of ["/tr/blog/reuse-one-cv-profile", "/tr/legal/privacy"]) {
    await page.goto(path);
    const links = page.locator(".article-links a");
    expect(await links.count()).toBeGreaterThan(1);
    const boxes = await links.evaluateAll((items) => items.map((item) => {
      const { left, right, top, bottom, height } = item.getBoundingClientRect();
      return { left, right, top, bottom, height };
    }));
    for (const [index, box] of boxes.entries()) {
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.right).toBeLessThanOrEqual(320);
      const previous = boxes[index - 1];
      if (!previous) continue;
      if (box.top === previous.top) expect(box.left - previous.right).toBeGreaterThanOrEqual(8);
      else expect(box.top - previous.bottom).toBeGreaterThanOrEqual(8);
    }
  }
  await page.getByRole("link", { name: "Kullanım koşulları", exact: true }).click();
  await expect(page).toHaveURL(/\/tr\/legal\/terms$/);
});
