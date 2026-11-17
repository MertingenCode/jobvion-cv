"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { renderCv } from "@/lib/cv/document";
import { emptyEntry, initialProfile, type CvChoice } from "@/lib/cv/model";
import { templates, type Template } from "@/lib/cv/templates";

const filters = ["all", "free", "premium", "ats", "photos", "photoFree"] as const;
type Filter = (typeof filters)[number];

export function TemplateGallery({ choice, select }: { choice: CvChoice; select: (template: Template) => void }) {
  const t = useTranslations("cv");
  const shared = useTranslations();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState(false);
  const visible = templates.filter((template) => filter === "all" || filter === template.tier ||
    (filter === "ats" && template.ats_safe) || (filter === "photos" && template.supports_photo) || (filter === "photoFree" && !template.supports_photo));
  const example = {
    ...initialProfile,
    name: "Alex Morgan", title: shared("role"), summary: shared("introduction"),
    experience: [{ ...emptyEntry, title: shared("role"), detail: shared("sampleWork") }],
    skills: shared("sampleSkills").split(",").map((part) => part.trim()),
  };

  return <details className="cv-gallery cv-repeat" onToggle={(event) => setExpanded(event.currentTarget.open)}>
    <summary>{t("templates")} <span>({templates.length})</span></summary>
    {expanded && <div className="cv-fields">
      <div className="cv-toolbar" aria-label={t("filter")}>
        {filters.map((item) => <button className="cv-filter" type="button" key={item} aria-pressed={filter === item}
          onClick={() => setFilter(item)}>{t(item)}</button>)}
      </div>
      <ul className="cv-gallery-grid">
        {visible.map((template) => <li key={template.id}>
          <button className="cv-gallery-card" type="button" aria-pressed={choice.template === template.id}
            aria-label={t("use") + ": " + template.name} onClick={() => select(template)}>
            <div className="cv-thumb" aria-hidden="true">
              <div dangerouslySetInnerHTML={{ __html: renderCv(example, { ...choice, paper: "A4", photo: false }, template) }} />
            </div>
            <strong>{template.name}</strong>
            <span>{t(template.tier)} · {t(template.ats_safe ? "ats" : "design")}</span>
            {template.supports_photo && <span>{t("photos")}</span>}
          </button>
        </li>)}
      </ul>
    </div>}
  </details>;
}
