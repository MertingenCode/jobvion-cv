import { expect, test } from "@playwright/test";

test("the editor and its data operations require a session", async ({ request }) => {
  const editor = await request.get("/tr/app/cv");
  expect(editor.url()).toMatch(/\/tr\/login$/);
  for (const route of ["/api/cv", "/api/cv/pdf", "/api/cv/photo"]) {
    expect((await request.post(route, { data: {} })).status()).toBe(401);
  }
  expect((await request.get("/api/cv/photo")).status()).toBe(401);
});

test("cross-origin CV requests are rejected before reaching the session", async ({ request }) => {
  const response = await request.post("/api/cv", {
    headers: { Origin: "https://other.example.test" }, data: {},
  });
  expect(response.status()).toBe(403);
});
