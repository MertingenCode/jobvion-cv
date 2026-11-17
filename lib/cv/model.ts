import { z } from "zod";
import { locales } from "@/i18n/config";

export const cvTemplateId = z.string().regex(/^[a-z][a-z0-9-]{0,39}$/);
export const paperSizes = ["A4", "Letter"] as const;
export const cvLocale = z.enum(locales);
const text = (size: number) => z.string().trim().max(size);
const period = z.string().regex(/^(?:\d{4}-(?:0[1-9]|1[0-2]))?$/);
const entry = z.strictObject({
  title: text(140), organization: text(140), location: text(100),
  start: period, end: period, detail: text(1600),
});
export const sections = ["experience", "education", "projects", "certificates", "languages"] as const;
const biography = z.strictObject({
  name: text(120), title: text(140), email: text(254),
  phone: text(50), location: text(140), website: text(254), summary: text(1800),
  skills: z.array(text(80)).max(40),
  experience: z.array(entry).max(12),
  education: z.array(entry).max(10),
  projects: z.array(entry).max(10),
  certificates: z.array(entry).max(10),
  languages: z.array(entry).max(10),
});
export const profileSchema = biography.extend({ schema_version: z.literal(1) });
export type Profile = z.infer<typeof profileSchema>;
export type Section = (typeof sections)[number];

export const emptyEntry = { title: "", organization: "", location: "", start: "", end: "", detail: "" };
export const initialProfile: Profile = {
  schema_version: 1, name: "", title: "", email: "", phone: "", location: "", website: "", summary: "",
  skills: [], experience: [], education: [], projects: [], certificates: [], languages: [],
};
export const cvChoice = z.strictObject({
  template: cvTemplateId,
  language: cvLocale,
  paper: z.enum(paperSizes),
  photo: z.boolean(),
});
export type CvChoice = z.infer<typeof cvChoice>;
export const saveProfileInput = z.strictObject({ revision: z.number().int().nonnegative(), profile: profileSchema });
export const savedCvInput = z.strictObject({ id: z.uuid(), profile: profileSchema, choice: cvChoice });
export const exportInput = z.union([
  z.strictObject({ profile: profileSchema, choice: cvChoice }),
  z.strictObject({ id: z.uuid() }),
]);
export const photoMaxBytes = 4 * 1024 * 1024;
export const normalizedPhotoMaxBytes = 400 * 1024;
