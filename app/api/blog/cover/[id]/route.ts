import { z } from "zod";
import { adminSession } from "@/lib/admin/access";
import { permitted } from "@/lib/admin/roles";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";
import { BodyTooLarge, cvError, cvJson, cvSameOrigin, privateResponse, readBytes } from "@/lib/cv/http";
import { photoMaxBytes } from "@/lib/cv/model";
import { normalizePortrait } from "@/lib/cv/photo";
import { readEnv } from "@/lib/env";
import { serviceSupabase } from "@/lib/supabase/admin";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success || !readEnv().SUPABASE_SERVICE_ROLE_KEY) return cvError("notFound", 404);
  const db = serviceSupabase();
  const publicCover = await db.from("blog_covers").select("jpeg_base64,blog_posts!inner(status)")
    .eq("post_id", id).eq("blog_posts.status", "published").maybeSingle();
  if (publicCover.error) return cvError("unavailable", 503);
  let cover = publicCover.data?.jpeg_base64;

  if (!cover) {
    const session = await adminSession();
    if (!session?.mfa || !permitted(session.role, "write")) return cvError("notFound", 404);
    const draft = await db.from("blog_covers").select("jpeg_base64").eq("post_id", id).maybeSingle();
    if (draft.error) return cvError("unavailable", 503);
    cover = draft.data?.jpeg_base64;
  }

  if (!cover) return cvError("notFound", 404);
  return new Response(new Uint8Array(Buffer.from(cover, "base64")), {
    headers: { ...privateResponse, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff" },
  });
}

async function write(request: Request, { params }: Context, remove: boolean) {
  if (!cvSameOrigin(request)) return cvError("unauthorized", 403);
  const session = await adminSession();
  if (!session?.mfa || !permitted(session.role, "write")) return cvError("unauthorized", 403);
  if (!await allowAuthAttempt("portrait", session.id)) return cvError("limited", 429);
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return cvError("notFound", 404);
  let jpeg = null, alt = null;
  if (!remove) {
    try {
      alt = z.string().trim().min(1).max(180).parse(decodeURIComponent(request.headers.get("x-jobvion-alt") ?? ""));
      const bytes = await readBytes(request, photoMaxBytes);
      const normalized = await normalizePortrait(bytes, request.headers.get("content-type") ?? "");
      if (!normalized) return cvError("photoInvalid", 400);
      jpeg = normalized.toString("base64");
    } catch (error) {
      return cvError("photoInvalid", error instanceof BodyTooLarge ? 413 : 400);
    }
  }
  const { error } = await session.supabase.rpc("write_blog_cover", { p_post: id, p_jpeg: jpeg, p_alt: alt });
  return error ? cvError("conflict", 409) : cvJson({ alt });
}

export function POST(request: Request, context: Context) { return write(request, context, false); }
export function DELETE(request: Request, context: Context) { return write(request, context, true); }
