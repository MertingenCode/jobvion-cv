import "server-only";
import { cache } from "react";
import { z } from "zod";
import { serverSupabase } from "@/lib/supabase/server";
import { cvChoice, initialProfile, profileSchema } from "@/lib/cv/model";

export const cvSession = cache(async () => {
  const db = await serverSupabase();
  const claims = await db?.auth.getClaims();
  const id = claims?.data?.claims.sub;
  return db && typeof id === "string" && !claims?.error ? { db, id } : null;
});

export type CvSession = NonNullable<Awaited<ReturnType<typeof cvSession>>>;
const saved = z.object({
  id: z.uuid(), template: z.string(), cv_language: cvChoice.shape.language,
  paper: cvChoice.shape.paper, photo_enabled: z.boolean(), created_at: z.string(),
  profile_snapshot: profileSchema,
});
export type SavedCv = z.infer<typeof saved>;
export type SavedCard = Pick<SavedCv, "id" | "template" | "cv_language" | "created_at"> & { title: string };

export async function readCvWorkspace({ db, id }: CvSession) {
  const [profile, docs, photo, entitlement] = await Promise.all([
    db.from("profiles").select("data,revision").eq("user_id", id).maybeSingle(),
    db.from("cvs").select("id,template,cv_language,created_at,profile_snapshot->>name").eq("user_id", id)
      .order("created_at", { ascending: false }).order("id").limit(50),
    db.from("cv_profile_photos").select("updated_at").eq("user_id", id).maybeSingle(),
    db.rpc("can_use_cv_template", { p_template: "atlas", p_photo: false }),
  ]);
  if (profile.error || docs.error || photo.error || entitlement.error) return null;
  const parsed = profileSchema.safeParse(profile.data?.data);
  const cards = z.array(z.object({
    id: z.uuid(), template: z.string(), cv_language: cvChoice.shape.language, created_at: z.string(), name: z.string().nullable().optional(),
  })).safeParse(docs.data);
  if (!cards.success || (profile.data && !parsed.success)) return null;
  return {
    profile: parsed.data ?? initialProfile,
    revision: (profile.data?.revision ?? 0) as number,
    photoVersion: (photo.data?.updated_at ?? null) as string | null,
    premium: entitlement.data === true,
    cards: cards.data.map(({ name, ...card }): SavedCard => ({ ...card, title: name ?? "" })),
  };
}

export async function fetchSavedCv({ db, id }: CvSession, documentId: string) {
  const { data, error } = await db.from("cvs").select("*").eq("user_id", id).eq("id", documentId).maybeSingle();
  const record = saved.safeParse(data);
  return !error && record.success ? record.data : null;
}

export async function userPhoto({ db, id }: CvSession) {
  const { data, error } = await db.from("cv_profile_photos").select("jpeg_base64,updated_at").eq("user_id", id).maybeSingle();
  if (error) return { error: true as const, photo: null };
  const photo = z.object({ jpeg_base64: z.base64().max(546136), updated_at: z.string() }).nullable().safeParse(data);
  return photo.success ? { error: false as const, photo: photo.data } : { error: true as const, photo: null };
}
