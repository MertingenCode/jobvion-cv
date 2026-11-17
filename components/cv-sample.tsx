import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";

export function CvSample({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();
  return (
    <figure className={compact ? "cv-stage cv-stage-compact" : "cv-stage"}>
      <figcaption className="cv-caption"><FileText size={15} aria-hidden="true" />{t("sample")}</figcaption>
      <div className="cv-paper">
        <header className="cv-heading">
          <p className="cv-name">Alex Morgan</p>
          <p className="cv-role">{t("role")}</p>
        </header>
        <section><h2>{t("profile")}</h2><p>{t("introduction")}</p></section>
        <section><h2>{t("experience")}</h2><p>{t("sampleWork")}</p></section>
        <section><h2>{t("skills")}</h2><p>{t("sampleSkills")}</p></section>
      </div>
    </figure>
  );
}
