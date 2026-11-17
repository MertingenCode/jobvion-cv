import "server-only";
import { readEnv } from "@/lib/env";

const validKey = /^[A-Za-z0-9_-]{10,128}$/;

export function signupSiteKey() {
  const key = process.env.TURNSTILE_SITE_KEY;
  return key && validKey.test(key) ? key : undefined;
}

export function signupChallengeRequired() {
  const host = new URL(readEnv().APP_ORIGIN).hostname;
  return !["localhost", "127.0.0.1", "[::1]"].includes(host);
}
