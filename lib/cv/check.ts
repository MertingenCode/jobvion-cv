import labels from "@/messages/cv.json";
import type { Locale } from "@/i18n/config";
import { emptyEntry, initialProfile, profileSchema, type Profile } from "./model";
import type { Template } from "./templates";

export const checkIds = ["contact", "experience", "skills", "dates", "readability"] as const;
type Check = typeof checkIds[number];
const headings = ["summary", "experience", "skills", "education", "projects", "certificates", "languages"] as const;
type Heading = typeof headings[number];

const email = /[\p{L}\d._%+-]+@[\p{L}\d.-]+\.[\p{L}]{2,}/iu;
const phone = /(?:^|\s)(?:\+\d[\d ().-]{7,24}\d|\d{10,15})(?=$|\s)/u;
const experienceHeadings: Record<Locale, string[]> = {
  tr: ["İş deneyimi", "Mesleki deneyim"], en: ["Work experience", "Employment history"],
  de: ["Berufserfahrung", "Beruflicher Werdegang"], fr: ["Expérience professionnelle"],
  es: ["Experiencia laboral", "Experiencia profesional"], it: ["Esperienza lavorativa"],
  pt: ["Experiência profissional"], nl: ["Werkervaring"],
};
const dates =/\b(?:19|20)\d{2}\b/u;
const clean = (value: string) => value.normalize("NFKC").trim().replace(/[:：]$/u, "").toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
const rows = (value: string) => value.slice(0, 16000).split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);

function findHeading(line: string, locale: Locale) {
  const text = clean(line);
  return headings.find((key) => {
    const options = [labels[locale][key], labels.en[key], ...(key === "experience" ? experienceHeadings[locale] : [])];
    return options.some((label) => clean(label) === text);
  });
}

export function scoreText(value: string, locale: Locale) {
  const lines = rows(value);
  const sections = new Set(lines.map((line) => findHeading(line, locale)));
  const named = (heading: Heading) => sections.has(heading);
  return scored({
    contact: email.test(value.slice(0, 16000)) || phone.test(value.slice(0, 16000)),
    experience: named("experience") && lines.length >= 5,
    skills: named("skills"),
    dates: lines.some((line) => dates.test(line) && !phone.test(line)),
    readability: lines.filter((line) => /\p{L}/u.test(line)).length >= 6 && lines.every((line) => line.length <= 280),
  });
}

export function scoreProfile(profile: Profile, template: Template, photo: boolean) {
  return scored({
    contact: Boolean(profile.name.trim() && (email.test(profile.email) || profile.phone.trim())),
    experience: profile.experience.some(({ title, organization, detail }) => Boolean(title && organization && detail)),
    skills: profile.skills.filter((skill) => skill.trim()).length >= 1,
    dates: profile.experience.some(({ start }) => Boolean(start)),
    readability: template.ats_safe && !photo,
  });
}

function scored(checks: Record<Check, boolean>) {
  return { score: checkIds.filter((id) => checks[id]).length * 20, checks };
}

export function importCvText(value: string, locale: Locale) {
  const profile: Profile = { ...initialProfile };
  const lines = rows(value);
  const contact = value.slice(0, 16000).match(email)?.[0];
  profile.phone = value.slice(0, 16000).match(phone)?.[0].trim().slice(0, 50) ?? "";
  if (contact) profile.email = contact.slice(0, 254);
  const groups: Partial<Record<Heading, string[]>> = {};
  const front: string[] = [];
  let group: Heading | undefined;
  for (const line of lines) {
    const heading = findHeading(line, locale);
    if (heading) {
      group = heading;
      groups[heading] ??= [];
    } else if (group) {
      groups[group]?.push(line);
    } else if (!email.test(line) && !phone.test(line)) {
      front.push(line);
    }
  }
  profile.name = (front[0] ?? "").slice(0, 120);
  profile.title = (front[1] ?? "").slice(0, 140);
  profile.summary = (groups.summary ?? front.slice(2)).join("\n").slice(0, 1800);
  profile.skills = (groups.skills ?? []).flatMap((line) => line.split(/[,;•]/u))
    .map((part) => part.trim().slice(0, 80)).filter(Boolean).slice(0, 40);
  for (const key of ["experience", "education", "projects", "certificates", "languages"] as const) {
    const section = groups[key] ?? [];
    if (section.length) profile[key] = [{ ...emptyEntry, title: section[0].slice(0, 140), detail: section.join("\n").slice(0, 1600) }];
  }
  return profileSchema.parse(profile);
}
