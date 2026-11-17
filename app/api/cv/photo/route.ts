import { cvSession, userPhoto } from "@/lib/cv/data";
import { BodyTooLarge, cvError, cvSameOrigin, cvJson, privateResponse, readBytes } from "@/lib/cv/http";
import { photoMaxBytes } from "@/lib/cv/model";
import { normalizePortrait } from "@/lib/cv/photo";
import { serviceSupabase } from "@/lib/supabase/admin";
import { readEnv } from "@/lib/env";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";

export async function GET() {
  const session = await cvSession();
  if (!session) return cvError("unauthorized", 401);
  const { photo, error } = await userPhoto(session);
  if (error) return cvError("unavailable", 503);
  if (!photo) return cvError("notFound", 404);
  return new Response(new Uint8Array(Buffer.from(photo.jpeg_base64, "base64")), {
    headers: { ...privateResponse, "Content-Type": "image/jpeg", "Cross-Origin-Resource-Policy": "same-origin", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(request: Request) {
  if (!cvSameOrigin(request)) return cvError("unauthorized", 403);
  const session = await cvSession();
  if (!session) return cvError("unauthorized", 401);
  if (!await allowAuthAttempt("portrait", session.id)) return cvError("limited", 429);
  if (!readEnv().SUPABASE_SERVICE_ROLE_KEY) return cvError("unavailable", 503);
  let bytes: Uint8Array;
  try {
    bytes = await readBytes(request, photoMaxBytes);
  } catch (error) {
    return cvError("photoInvalid", error instanceof BodyTooLarge ? 413 : 400);
  }
  const normalized = await normalizePortrait(bytes, request.headers.get("content-type") ?? "");
  if (!normalized) return cvError("photoInvalid", 400);
  const version = new Date().toISOString();
  const { error } = await serviceSupabase().from("cv_profile_photos").upsert({
    user_id: session.id, jpeg_base64: normalized.toString("base64"), updated_at: version,
  }, { onConflict: "user_id" });
  return error ? cvError("unavailable", 503) : cvJson({ version });
}

export async function DELETE(request: Request) {
  if (!cvSameOrigin(request)) return cvError("unauthorized", 403);
  const session = await cvSession();
  if (!session) return cvError("unauthorized", 401);
  if (!await allowAuthAttempt("portrait", session.id)) return cvError("limited", 429);
  if (!readEnv().SUPABASE_SERVICE_ROLE_KEY) return cvError("unavailable", 503);
  const { error } = await serviceSupabase().from("cv_profile_photos").delete().eq("user_id", session.id);
  return error ? cvError("unavailable", 503) : cvJson({ version: null });
}
