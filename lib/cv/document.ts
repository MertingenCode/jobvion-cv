import type { CvChoice, Profile, Section } from "@/lib/cv/model";
import type { Template } from "@/lib/cv/templates";
import labels from "@/messages/cv.json";

const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[character] ?? character));

function paragraph(value: string) {
  return value ? `<p>${escape(value)}</p>` : "";
}

function block(heading: string, content: string) {
  return content ? `<section class="cv-section"><h2>${escape(heading)}</h2>${content}</section>` : "";
}

export function renderCv(profile: Profile, choice: CvChoice, template: Template, photo?: string) {
  const t = labels[choice.language];
  const dates = new Intl.DateTimeFormat(choice.language, { year: "numeric", month: "short", timeZone: "UTC" });
  function localDate(value: string) {
    return value ? dates.format(new Date(value + "-01T00:00:00Z")) : "";
  }
  function entrySection(section: Section) {
    const entries = profile[section].map((entry) => {
      if (!Object.values(entry).some(Boolean)) return "";
      const date = [localDate(entry.start), localDate(entry.end)].filter(Boolean).join(" – ");
      const meta = [entry.organization, entry.location, date].filter(Boolean).join(" · ");
      return `<div class="cv-entry">${entry.title ? `<h3>${escape(entry.title)}</h3>` : ""}${
        meta ? `<p class="cv-meta">${escape(meta)}</p>` : ""
      }${paragraph(entry.detail)}</div>`;
    }).join("");
    return block(t[section], entries);
  }

  const photoAllowed = template.supports_photo && choice.photo && photo != null
    && (/^\/api\/cv\/photo(?:\?v=[A-Za-z0-9%:.+-]+)?$/.test(photo) || /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(photo));
  const contact = [profile.email, profile.phone, profile.location, profile.website].filter(Boolean);
  const primary = block(t.summary, paragraph(profile.summary)) + entrySection("experience") + entrySection("education") + entrySection("projects");
  const secondary = block(t.skills, profile.skills.filter(Boolean).map(escape).join(", ")) +
    entrySection("certificates") + entrySection("languages");
  const columns = template.columns === 2 && Boolean(primary && secondary);
  const header = `<header class="cv-doc-header${photoAllowed ? " cv-photo-header" : ""}">
    <div><h1>${escape(profile.name || t.name)}</h1>
      ${profile.title ? `<p class="cv-role">${escape(profile.title)}</p>` : ""}
      ${contact.length ? `<p class="cv-contact">${contact.map(escape).join(" · ")}</p>` : ""}
    </div>${photoAllowed ? `<img class="cv-portrait" src="${photo}" alt="">` : ""}</header>`;
  const body = columns ? `<div class="cv-doc-columns"><div>${primary}</div><div class="cv-aside">${secondary}</div></div>`
    : `<div class="cv-doc-linear">${primary}${secondary}</div>`;

  return `<article class="cv-sheet cv-layout-${template.layout} cv-head-${template.header} cv-label-${template.heading} cv-type-${template.typography} cv-color-${template.color} cv-paper-${choice.paper}"
    lang="${choice.language}" style="--cv-accent:${template.accent}">${header}${body}</article>`;
}
