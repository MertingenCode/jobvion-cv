import { FileText } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { isLocale } from "@/i18n/config";
import { sampleProfile } from "@/lib/cv/sample";

export function CvSample() {
  const t = useTranslations();
  const cv = useTranslations("cv");
  const locale = useLocale();
  const format = useFormatter();
  const profile = sampleProfile(isLocale(locale) ? locale : "en");
  return <figure className="cv-stage">
    <figcaption className="cv-caption"><FileText size={16} aria-hidden="true" />{t("sample")}</figcaption>
    <div className="cv-paper sample-document">
      <header className="sample-header">
        <p className="cv-name">{profile.name}</p>
        <p className="cv-role">{profile.title}</p>
        <address>{profile.location} <span>{profile.email}</span></address>
      </header>
      <div className="sample-body">
        <div>
          <section><h2>{cv("summary")}</h2><p>{profile.summary}</p></section>
          <section><h2>{cv("experience")}</h2>
            {profile.experience.map((entry) => <div className="sample-entry" key={entry.organization}>
              <h3>{entry.title}</h3>
              <p className="sample-meta">{entry.organization}<span>{format.dateTime(new Date(entry.start + "-01T00:00:00Z"), { year: "numeric", timeZone: "UTC" })}{entry.end ? "–" + entry.end.slice(0,4) : "–"}</span></p>
              <p>{entry.detail}</p>
            </div>)}
          </section>
        </div>
        <div>
          <section><h2>{cv("skills")}</h2><ul>{profile.skills.map((skill) => <li key={skill}>{skill}</li>)}</ul></section>
          <section><h2>{cv("education")}</h2><p>{profile.education[0].title}</p><p>{profile.education[0].organization}</p></section>
        </div>
      </div>
    </div>
  </figure>;
}
