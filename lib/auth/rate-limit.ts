import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { readEnv } from "@/lib/env";

type Scope = "login" | "signup" | "oauth";
const spanMs = 10 * 60 * 1000;
const localWindows = new Map<string, { count: number; expires: number }>();
const limits = { login: 10, signup: 5, oauth: 10 } as const;

export async function allowAuthAttempt(scope: Scope, email?: string) {
  const env = readEnv();
  const requestHeaders = await headers();
  const ip = env.TRUSTED_IP_HEADER
    ? requestHeaders.get(env.TRUSTED_IP_HEADER)?.split(",").at(0)?.trim()
    : "127.0.0.1";
  if (!ip || !isIP(ip)) return false;
  const identities = ["ip:" + ip];
  if (email) identities.push("email:" + email.toLowerCase());
  const keys = identities.map((value) => scope + ":" + createHash("sha256").update(value).digest("hex"));
  const redisUrl = env.UPSTASH_REDIS_REST_URL;
  const redisToken = env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    try {
      const limiter = new Ratelimit({
        redis: new Redis({ url: redisUrl, token: redisToken }),
        limiter: Ratelimit.slidingWindow(limits[scope], "10 m"),
        prefix: "jobvion:auth",
        analytics: false,
      });
      const results = await Promise.all(keys.map((key) => limiter.limit(key)));
      return results.every((result) => result.success);
    } catch {
      return false;
    }
  }

  const now = Date.now();
  for (const [key, window] of localWindows) {
    if (window.expires <= now) localWindows.delete(key);
  }
  if (localWindows.size + keys.length > 10_000) return false;
  return keys.map((key) => {
    const window = localWindows.get(key) ?? { count: 0, expires: now + spanMs };
    window.count++;
    localWindows.set(key, window);
    return window.count <= limits[scope];
  }).every(Boolean);
}
