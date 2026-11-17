import { z } from "zod";
import { sections, type Profile } from "@/lib/cv/model";
import { applicationCopy } from "@/lib/application/copy";
import type { Locale } from "@/i18n/config";

const short = (length: number) => z.string().trim().min(1).max(length);
export const reportSchema = z.strictObject({
  position: short(140), company: z.string().trim().max(140),
  required: z.array(short(80)).max(20), preferred: z.array(short(80)).max(16),
});
export type JobReport = z.infer<typeof reportSchema>;
export const selectionSchema = z.strictObject({
  skills: z.array(z.number().int().nonnegative()).max(40),
  experience: z.array(z.number().int().nonnegative()).max(12),
  evidence: z.array(z.number().int().nonnegative()).max(2),
});
export type Selection = z.infer<typeof selectionSchema>;

export function stripContact(value: string, profile: Profile) {
  let safe = value;
  for (const item of [profile.name, profile.email, profile.phone, profile.location, profile.website]) {
    if (item.trim().length > 2) safe = safe.replace(new RegExp(item.trim().replace(/[.*+?^${}()|[\]\\]/g,"\\$&"), "giu"), "[private]");
  }
  return safe.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,"[private]")
    .replace(/https?:\/\/\S+/gi,"[private]")
    .replace(/(?:\+\d[\d .()-]{7,}\d|\b\d{10,15}\b)/g,"[private]");
}

const normalized = (value: string) => value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");

export function groundReport(report: JobReport, document: string) {
  const source = normalized(document);
  const found = (term: string) => {
    const text = normalized(term);
    return Boolean(text) && !text.includes("[private]") && source.includes(text);
  };
  if (!found(report.position)) throw new Error("Advertised role is missing.");
  return {
    position: report.position,
    company: found(report.company) ? report.company : "",
    required: report.required.filter(found),
    preferred: report.preferred.filter(found),
  };
}

export function reportMatches(report: JobReport, profile: Profile) {
  const facts = [
    profile.title, profile.summary, ...profile.skills,
    ...sections.flatMap((section) => profile[section].flatMap(({ title, organization, detail }) => [title, organization, detail])),
  ].map(normalized);
  const seen = new Set<string>();
  const items = [...report.required.map((term) => ({term,level:"required" as const})),
    ...report.preferred.map((term) => ({term,level:"preferred" as const}))];
  return items.filter(({term}) => {
    const key = normalized(term);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((item) => {
    const needle = normalized(item.term).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
    const pattern = new RegExp("(^|[^\\p{L}\\p{N}_])"+needle+"($|[^\\p{L}\\p{N}_])", "u");
    return { ...item, matched: facts.some((fact) => pattern.test(fact)) };
  });
}

export function applicationEvidence(profile: Profile) {
  return profile.experience.map(({title,detail}) => detail.trim() || title.trim());
}

function reorder<T>(items: T[], proposed: number[]) {
  if (new Set(proposed).size !== proposed.length || proposed.some((index) => index < 0 || index >= items.length)) {
    throw new Error("Invalid profile reference.");
  }
  return [...proposed.map((index) => items[index]), ...items.filter((_, index) => !proposed.includes(index))];
}

export function buildApplication(profile: Profile, report: JobReport, selected: Selection, locale: Locale) {
  const tailored = { ...profile, skills: reorder(profile.skills, selected.skills),
    experience: reorder(profile.experience, selected.experience) };
  const evidence = applicationEvidence(profile);
  if (new Set(selected.evidence).size !== selected.evidence.length ||
      selected.evidence.some((index) => index < 0 || !evidence[index])) throw new Error("Invalid letter reference.");
  const copy = applicationCopy[locale];
  const intro = copy.applying.replace("{role}", () => report.position);
  const cover = [copy.greeting, intro, ...selected.evidence.map((index) => evidence[index]), copy.closing, profile.name].filter(Boolean).join("\n\n");
  return {
    profile: tailored, cover,
    before: { skills: profile.skills, experience: profile.experience.map(({title, organization}) => ({title, organization})) },
  };
}
