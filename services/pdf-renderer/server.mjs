import { createServer } from "node:http";
import { createHash, timingSafeEqual } from "node:crypto";
import { chromium } from "playwright-core";

const token = process.env.PDF_RENDERER_TOKEN;
if (!token || token.length < 32) throw new Error("PDF_RENDERER_TOKEN must contain at least 32 characters.");
const host = process.env.PDF_BIND_HOST ?? "127.0.0.1";
const port = Number(process.env.PDF_BIND_PORT ?? 4025);
const expected = digest("Bearer " + token);
const maximum = 2 * 1024 * 1024;
let active = 0;
let browser;

function digest(text) {
  return createHash("sha256").update(text).digest();
}

async function rendererBrowser() {
  if (!browser?.isConnected()) {
    const newBrowser = await chromium.launch({
      headless: true,
      chromiumSandbox: true,
      timeout: 8_000,
      channel: process.env.PDF_CHROMIUM_CHANNEL || undefined,
    });
    browser = newBrowser;
  }
  return browser;
}

async function render(html) {
  const instance = await rendererBrowser();
  const context = await instance.newContext({ javaScriptEnabled: false, offline: true, serviceWorkers: "block" });
  try {
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(5_000);
    await page.setContent(html, { waitUntil: "load", timeout: 5_000 });
    return await page.pdf({ printBackground: true, preferCSSPageSize: true, tagged: true, timeout: 7_000 });
  } finally {
    await context.close();
  }
}

function fail(response, status) {
  response.writeHead(status, { "Cache-Control": "no-store" });
  response.end();
}

const server = createServer({ requestTimeout: 10_000, headersTimeout: 5_000 }, async (request, response) => {
  if (request.method !== "POST" || request.url !== "/render") return fail(response, 404);
  if (!timingSafeEqual(digest(request.headers.authorization ?? ""), expected)) return fail(response, 403);
  if (!(request.headers["content-type"] ?? "").startsWith("text/html")) return fail(response, 415);
  if (Number(request.headers["content-length"]) > maximum) return fail(response, 413);
  if (active >= 1) return fail(response, 429);
  active++;

  let timeout;
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
      size += chunk.length;
      if (size > maximum) return fail(response, 413);
      chunks.push(chunk);
    }
    if (!size) return fail(response, 400);
    const html = Buffer.concat(chunks, size).toString("utf8");
    const pending = render(html);
    const deadline = new Promise((_, reject) => {
      timeout = setTimeout(() => {
        reject(new Error("Renderer timed out."));
        void browser?.close().catch(() => {});
      }, 15_000);
    });
    const pdf = await Promise.race([pending, deadline]);
    if (pdf.length > 8 * 1024 * 1024) return fail(response, 413);
    response.writeHead(200, { "Content-Type": "application/pdf", "Content-Length": pdf.length, "Cache-Control": "no-store" });
    response.end(pdf);
  } catch {
    if (!response.headersSent && !response.destroyed) fail(response, 503);
  } finally {
    clearTimeout(timeout);
    active--;
  }
});

server.listen(port, host, () => console.log("Jobvion PDF renderer listening."));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    void browser?.close().catch(() => {});
  });
}
