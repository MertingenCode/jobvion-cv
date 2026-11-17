import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { readEnv } from "@/lib/env";
import { serviceSupabase } from "@/lib/supabase/admin";

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export async function POST(request: NextRequest) {
  const env = readEnv();
  const secret = env.BLOG_CRON_SECRET;
  const authorization = request.headers.get("authorization") ?? "";
  if (!secret || !timingSafeEqual(digest(authorization), digest("Bearer " + secret))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
  const { data, error } = await serviceSupabase().rpc("publish_due_blog_posts");
  if (error) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  return NextResponse.json({ published: data });
}
