import { z } from "zod";
import { cvSession, fetchSavedCv } from "@/lib/cv/data";
import { cvError, cvSameOrigin, cvJson, readCvJson } from "@/lib/cv/http";
import { savedCvInput, saveProfileInput } from "@/lib/cv/model";
import { getTemplate } from "@/lib/cv/templates";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";

const mutation = z.discriminatedUnion("operation", [
  saveProfileInput.extend({ operation: z.literal("draft") }),
  savedCvInput.extend({ operation: z.literal("save") }),
  z.strictObject({ operation: z.literal("delete"), id: z.uuid() }),
]);

export async function POST(request: Request) {
  if (!cvSameOrigin(request)) return cvError("unauthorized", 403);
  const session = await cvSession();
  if (!session) return cvError("unauthorized", 401);
  if (!await allowAuthAttempt("cv", session.id)) return cvError("limited", 429);
  const parsed = mutation.safeParse(await readCvJson(request));
  if (!parsed.success) return cvError("invalid", 400);
  const { db, id } = session;
  const input = parsed.data;
  if (input.operation === "draft") {
    const { data, error } = await db.rpc("save_cv_profile", { p_revision: input.revision, p_data: input.profile });
    if (error?.code === "40001") return cvError("conflict", 409);
    if (error || !Number.isInteger(data)) return cvError("unavailable", 503);
    return cvJson({ revision: data });
  }

  if (input.operation === "delete") {
    const { error } = await db.from("cvs").delete().eq("user_id", id).eq("id", input.id);
    return error ? cvError("unavailable", 503) : cvJson({ id: input.id });
  }

  const template = getTemplate(input.choice.template);
  if (!template || (input.choice.photo && !template.supports_photo) || !input.profile.name) return cvError("invalid", 400);
  const { data: allowed, error: permissionError } = await db.rpc("can_use_cv_template", {
    p_template: template.id, p_photo: input.choice.photo,
  });
  if (permissionError) return cvError("unavailable", 503);
  if (allowed !== true) return cvError("locked", 403);
  const { error } = await db.from("cvs").insert({
    id: input.id, user_id: id, template: template.id, photo_enabled: input.choice.photo,
    cv_language: input.choice.language, paper: input.choice.paper, profile_snapshot: input.profile,
  });
  if (error?.code === "23505") {
    const previous = await fetchSavedCv(session, input.id);
    const same = previous && previous.template === template.id && previous.cv_language === input.choice.language
      && previous.paper === input.choice.paper && previous.photo_enabled === input.choice.photo
      && JSON.stringify(previous.profile_snapshot) === JSON.stringify(input.profile);
    return same ? cvJson({ id: input.id }) : cvError("conflict", 409);
  }
  if (error?.code === "42501") return cvError("locked", 403);
  return error ? cvError("unavailable", 503) : cvJson({ id: input.id });
}
