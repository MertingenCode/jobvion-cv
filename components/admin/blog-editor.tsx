"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveBlog, type AdminResult } from "@/lib/admin/actions";
import { localeNames, locales, type Locale } from "@/i18n/config";
import type { BlogPost } from "@/lib/blog/schema";

const fields = [
  { name: "title", label: "titleField", max: 120, required: true },
  { name: "slug", label: "slug", max: 100, required: true, pattern: "[a-z0-9]+(-[a-z0-9]+)*" },
  { name: "excerpt", label: "excerpt", max: 300, required: true, multiline: true },
  { name: "body", label: "body", max: 30000, required: true, multiline: true },
  { name: "author", label: "author", max: 100, required: true },
  { name: "category", label: "category", max: 60 },
  { name: "tags", label: "tags", max: 300 },
  { name: "translation_group", label: "group", max: 36 },
  { name: "seo_title", label: "seoTitle", max: 120 },
  { name: "seo_description", label: "seoDescription", max: 300, multiline: true },
] as const;

export function BlogEditor({ locale, post }: { locale: Locale; post?: BlogPost }) {
  const t = useTranslations("admin");
  const [result, submit, pending] = useActionState<AdminResult | null, FormData>(
    saveBlog.bind(null, locale, post?.id ?? null, post?.revision ?? null), null,
  );
  const [values, setValues] = useState({
    title: post?.title ?? "", slug: post?.slug ?? "", excerpt: post?.excerpt ?? "", body: post?.body ?? "",
    author: post?.author ?? "Jobvion", category: post?.category ?? "", tags: post?.tags.join(", ") ?? "",
    translation_group: post?.translation_group ?? "", seo_title: post?.seo_title ?? "",
    seo_description: post?.seo_description ?? "",
  });
  const [language, setLanguage] = useState<string>(post?.locale ?? locale);

  return <form action={submit} className="studio-form" aria-busy={pending}>
    <div className="field">
      <label htmlFor="post-locale">{t("language")}</label>
      <select className="input" id="post-locale" name="locale" value={language} onChange={(event) => setLanguage(event.target.value)}>
        {locales.map((code) => <option key={code} value={code} lang={code}>{localeNames[code]}</option>)}
      </select>
    </div>
    {fields.map((field) => {
      const id = "post-" + field.name;
      const hint = field.name === "body" ? "writingHelp" : field.name === "translation_group" ? "groupHelp" : null;
      const props = {
        id, name: field.name, value: values[field.name], maxLength: field.max,
        required: "required" in field && field.required,
        "aria-describedby": hint ? id + "-help" : undefined,
      };
      return <div className="field" key={field.name}>
        <label htmlFor={id}>{t(field.label)}</label>
        {"multiline" in field
          ? <textarea className="input" rows={field.name === "body" ? 18 : 3} {...props}
            onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />
          : <Input {...props} pattern={"pattern" in field ? field.pattern : undefined}
            onChange={(event) => setValues({ ...values, [field.name]: event.target.value })} />}
        {hint && <p className="studio-meta" id={id + "-help"}>{t(hint)}</p>}
      </div>;
    })}
    {result && <p role="alert" className="form-error">{t(result)}</p>}
    <Button type="submit" disabled={pending}>{t("save")}</Button>
  </form>;
}
