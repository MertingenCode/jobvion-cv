export async function register() {
  const { readEnv } = await import("@/lib/env");
  const { SENTRY_DSN } = readEnv();
  if (!SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") return;

  const Sentry = await import("@sentry/nextjs");
  Sentry.init({
    dsn: SENTRY_DSN,
    dataCollection: {
      userInfo: false, cookies: false, httpHeaders: false, httpBodies: [],
      urlQueryParams: false, stackFrameVariables: false, frameContextLines: 0,
      databaseQueryData: false, genAI: { inputs: false, outputs: false },
    },
    tracesSampleRate: 0,
    beforeBreadcrumb: () => null,
    beforeSend(event) {
      return {
        type: event.type,
        event_id: event.event_id,
        timestamp: event.timestamp,
        platform: "node",
        level: "error",
        message: "Unhandled Jobvion server error",
        fingerprint: ["jobvion", event.exception?.values?.[0]?.mechanism?.type === "onunhandledrejection" ? "rejection" : "error"],
      };
    },
  });
}

export async function onRequestError() {
  if (!process.env.SENTRY_DSN || process.env.NEXT_RUNTIME !== "nodejs") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureMessage("Jobvion request failed", "error");
}


