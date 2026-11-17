import { defineConfig, devices } from "@playwright/test";

const url = process.env.JOBVION_E2E_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    ...devices["Desktop Chrome"],
    channel: process.env.JOBVION_BROWSER === "bundled" ? undefined : "chrome",
    baseURL: url,
    trace: "retain-on-failure",
  },
  webServer: process.env.JOBVION_E2E_URL ? undefined : {
    command: "npm run dev -- --port 3000",
    url: url + "/en",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
