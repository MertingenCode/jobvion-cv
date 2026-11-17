import { cvSession, fetchSavedCv, userPhoto } from "@/lib/cv/data";
import { cvError, cvSameOrigin, privateResponse, readCvJson } from "@/lib/cv/http";
import { exportInput, type CvChoice, type Profile } from "@/lib/cv/model";
import { generateCvPdf } from "@/lib/cv/pdf";
import { getTemplate } from "@/lib/cv/templates";
import { allowAuthAttempt } from "@/lib/auth/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!cvSameOrigin(request)) return cvError("unauthorized", 403);
  const session = await cvSession();
  if (!session) return cvError("unauthorized", 401);
  if (!await allowAuthAttempt("pdf", session.id)) return cvError("limited", 429);
  const parsed = exportInput.safeParse(await readCvJson(request));
  if (!parsed.success) return cvError("invalid", 400);

  let profile: Profile;
  let choice: CvChoice;
  if ("id" in parsed.data) {
    const record = await fetchSavedCv(session, parsed.data.id);
    if (!record) return cvError("notFound", 404);
    profile = record.profile_snapshot;
    choice = { template: record.template, language: record.cv_language, paper: record.paper, photo: record.photo_enabled };
  } else {
    ({ profile, choice } = parsed.data);
  }
  const template = getTemplate(choice.template);
  if (!template || (choice.photo && !template.supports_photo) || !profile.name) return cvError("invalid", 400);
  const { data: allowed, error } = await session.db.rpc("can_use_cv_template", {
    p_template: template.id, p_photo: choice.photo,
  });
  if (error) return cvError("unavailable", 503);
  if (allowed !== true) return cvError("locked", 403);
  const portrait = choice.photo ? await userPhoto(session) : null;
  if (portrait?.error) return cvError("unavailable", 503);

  try {
    const photo = portrait?.photo ? "data:image/jpeg;base64," + portrait.photo.jpeg_base64 : undefined;
    const bytes = await generateCvPdf(profile, choice, template, photo);
    if (!bytes) return cvError("unavailable", 503);
    return new Response(new Uint8Array(bytes), { headers: {
      ...privateResponse, "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Jobvion-CV.pdf"',
      "X-Content-Type-Options": "nosniff",
    } });
  } catch {
    return cvError("unavailable", 503);
  }
}
