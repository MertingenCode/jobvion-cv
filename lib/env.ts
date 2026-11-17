import "server-only";
import { z } from "zod";

const optional = <T extends z.ZodType<string>>(schema: T) =>
  z.preprocess((value) => value === "" ? undefined : value, schema.optional());

const schema = z.object({
  APP_ORIGIN: z.url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: optional(z.url()),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: optional(z.string().min(1)),
  SUPABASE_SERVICE_ROLE_KEY: optional(z.string().min(1)),
  TRUSTED_IP_HEADER: optional(z.string().regex(/^[\w-]+$/)),
  UPSTASH_REDIS_REST_URL: optional(z.url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().min(1)),
  SENTRY_DSN: optional(z.url()),
  BLOG_CRON_SECRET: optional(z.string().min(32)),
  PDF_RENDERER_URL: optional(z.url().refine((value) => /^https?:\/\//.test(value))),
  PDF_RENDERER_TOKEN: optional(z.string().min(32)),
});

export function readEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    throw new Error("Invalid configuration: " + result.error.issues.map(({ path }) => path.join(".")).join(", "));
  }

  const env = result.data;
  if (Boolean(env.PDF_RENDERER_URL) !== Boolean(env.PDF_RENDERER_TOKEN)) {
    throw new Error("Configure both PDF renderer values");
  }
  const origin = new URL(env.APP_ORIGIN);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.origin !== env.APP_ORIGIN || (!local && origin.protocol !== "https:")) {
    throw new Error("APP_ORIGIN must be an origin without a trailing slash, using HTTPS outside localhost");
  }
  if (Boolean(env.NEXT_PUBLIC_SUPABASE_URL) !== Boolean(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)) {
    throw new Error("Configure both public Supabase values");
  }
  if (Boolean(env.UPSTASH_REDIS_REST_URL) !== Boolean(env.UPSTASH_REDIS_REST_TOKEN)) {
    throw new Error("Configure both Upstash values");
  }
  if (!local && (!env.NEXT_PUBLIC_SUPABASE_URL || !env.TRUSTED_IP_HEADER || !env.UPSTASH_REDIS_REST_URL)) {
    throw new Error("Nonlocal deployments require Supabase, Upstash, and a trusted client IP header");
  }
  return env;
}

