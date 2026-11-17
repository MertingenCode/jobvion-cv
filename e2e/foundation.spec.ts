import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("negotiates only the root, preserves explicit URLs, and remembers language selection", async ({ browser }) => {
  const context = await browser.newContext({ locale: "de-DE", reducedMotion: "reduce" });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/de$/);
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await page.goto("/en/login?source=home");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.locator('.preference-form[data-enhanced="true"]')).toHaveCount(2);
    await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("tr");
    await expect(page).toHaveURL(/\/tr\/login\?source=home$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/tr$/);
  } finally {
    await context.close();
  }
});

test("falls back to English for unsupported browser languages", async ({ page }) => {
  await page.setExtraHTTPHeaders({ "Accept-Language": "ja-JP,ja;q=0.9" });
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
});

test("uses the OS color scheme without JS on first paint and keeps sample paper white", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark", javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/en");
    await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 18, 32)");
    await expect(page.locator(".cv-paper")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  } finally {
    await context.close();
  }
});

test("uses live OS changes in System and persists a manual override", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/en");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 18, 32)");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await expect(page.locator('.preference-form[data-enhanced="true"]')).toHaveCount(2);
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator('.preference-form[data-enhanced="true"]')).toHaveCount(2);
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 18, 32)");
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
  await page.getByRole("combobox", { name: "Appearance", exact: true }).selectOption("system");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(11, 18, 32)");
});

test("protects the workspace and shows localized form labels on small screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/tr/app");
  await expect(page).toHaveURL(/\/tr\/login$/);
  await expect(page.getByRole("heading", { name: "Giriş yap" })).toBeVisible();
  await expect(page.getByLabel("E-posta adresi")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});

for (const mode of ["light", "dark"] as const) {
  for (const route of ["login", "signup"]) {
    test(`${route} has no WCAG AA violations in ${mode}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: mode });
      await page.goto(`/en/${route}`);
      const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
      expect(result.violations).toEqual([]);
    });
  }
}
