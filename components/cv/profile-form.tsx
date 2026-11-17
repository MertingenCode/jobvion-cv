"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { emptyEntry, sections, type Profile, type Section } from "@/lib/cv/model";

type FieldKey = "name" | "title" | "email" | "phone" | "location" | "website" | "summary" | "skills" |
  "organization" | "start" | "end" | "detail";

function Field({ label, children }: { label: FieldKey; children: (id: string) => ReactNode }) {
  const id = useId();
  const t = useTranslations("cv");
  return <div className="field"><label htmlFor={id}>{t(label)}</label>{children(id)}</div>;
}

const limits: Record<Section, number> = { experience: 12, education: 10, projects: 10, certificates: 10, languages: 10 };

export function ProfileForm({ profile, update }: { profile: Profile; update: (profile: Profile) => void }) {
  const t = useTranslations("cv");
  const [primary, contact] = [["name", "title"] as const, ["email", "phone", "location", "website"] as const];
  const maxLength = { name: 120, title: 140, email: 254, phone: 50, location: 140, website: 254 };
  const [skillsHelp, setSkillsHelp] = useState(() => profile.skills.join(", "));
  function basic(field: typeof primary[number] | typeof contact[number]) {
    return <Field label={field} key={field}>{(id) => <Input id={id} name={field} value={profile[field]}
      maxLength={maxLength[field]} type={field === "phone" ? "tel" : field === "email" ? "email" : "text"}
      onChange={(event) => update({ ...profile, [field]: event.target.value })} />}</Field>;
  }
  return <div className="cv-fields">
    <div className="cv-field-grid">{primary.map(basic)}{contact.map(basic)}</div>
    <Field label="summary">{(id) => <textarea id={id} className="input" rows={4} maxLength={1800}
      value={profile.summary} onChange={(event) => update({ ...profile, summary: event.target.value })} />}</Field>
    <Field label="skills">{(id) => <Input id={id} maxLength={3250} value={skillsHelp}
      onChange={(event) => {
        const value = event.target.value;
        setSkillsHelp(value);
        update({ ...profile, skills: value.split(",").slice(0, 40).map((item) => item.trim().slice(0, 80)).filter(Boolean) });
      }} />}</Field>
    <div aria-label={t("sections")} className="cv-repeat-sections">
      {sections.map((section) => <details className="cv-repeat" key={section}>
        <summary>{t(section)} <span>({profile[section].length})</span></summary>
        <div className="cv-fields">
          {profile[section].map((entry, position) => {
            function setEntry(key: keyof typeof emptyEntry, value: string) {
              update({ ...profile, [section]: profile[section].map((item, index) => index === position ? { ...item, [key]: value } : item) });
            }
            const fields = section === "languages" ? ["title"] as const : ["title", "organization", "location"] as const;
            return <fieldset className="cv-entry-fields" key={position}>
              <legend>{t(section)} {position + 1}</legend>
              <div className="cv-field-grid">
                {fields.map((field) => <Field key={field} label={field}>{(id) => <Input id={id}
                  value={entry[field]} maxLength={field === "location" ? 100 : 140}
                  onChange={(event) => setEntry(field, event.target.value)} />}</Field>)}
                {section !== "languages" && (["start", "end"] as const).map((field) =>
                  <Field label={field} key={field}>{(id) => <Input id={id} type="month" value={entry[field]}
                    onChange={(event) => setEntry(field, event.target.value)} />}</Field>)}
              </div>
              <Field label="detail">{(id) => <textarea id={id} className="input" rows={3} value={entry.detail} maxLength={1600}
                onChange={(event) => setEntry("detail", event.target.value)} />}</Field>
              <Button variant="quiet" type="button" onClick={() =>
                update({ ...profile, [section]: profile[section].filter((_, index) => index !== position) })}>{t("remove")}</Button>
            </fieldset>;
          })}
          <Button variant="outline" type="button" disabled={profile[section].length >= limits[section]}
            onClick={() => update({ ...profile, [section]: [...profile[section], emptyEntry] })}>{t("add")}</Button>
        </div>
      </details>)}
    </div>
  </div>;
}
