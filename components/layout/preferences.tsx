"use client";

import { usePathname } from "next/navigation";
import { useId, useSyncExternalStore, type ReactNode } from "react";
import { Check, ChevronDown, Globe2, Moon, Sun } from "lucide-react";
import { localeNames, locales, type Locale } from "@/i18n/config";
import { selectLocale, selectTheme } from "@/lib/security/actions";
import { saveBeforeLocaleChange } from "@/lib/cv/client";


const subscribeToHydration = () => () => {};
const hydrated = () => true;
const serverRendered = () => false;

function PreferenceSelect({ label, name, value, action, apply, children, icon, includePath }: {
  label: string;
  name: string;
  value: string;
  action: (form: FormData) => void;
  apply: string;
  children: ReactNode;
  icon: ReactNode;
  includePath?: boolean;
}) {
  const id = useId();
  const pathname = usePathname();
  const enhanced = useSyncExternalStore(subscribeToHydration, hydrated, serverRendered);
  return (
    <form action={action} className="preference-form" data-enhanced={enhanced}>
      {includePath && <input name="path" type="hidden" value={pathname} />}
      <label className="sr-only" htmlFor={id}>{label}</label>
      <div className="preference">
        <span className="preference-icon" aria-hidden="true">{icon}</span>
        <select
          id={id}
          key={value}
          name={name}
          defaultValue={value}
          onChange={async (event) => {
            const select = event.currentTarget;
            const form = select.form;
            if (includePath) {
              if (!await saveBeforeLocaleChange()) {
                select.value = value;
                return;
              }
              const field = form?.elements.namedItem("path");
              if (field instanceof HTMLInputElement) field.value = pathname + window.location.search;
            }
            form?.requestSubmit();
          }}
        >
          {children}
        </select>
        <ChevronDown className="preference-chevron" size={13} aria-hidden="true" />
      </div>
      <button type="submit" className="preference-submit" aria-label={apply}><Check size={18} aria-hidden="true" /></button>
    </form>
  );
}

export function Preferences({ locale, labels }: {
  locale: Locale;

  labels: Record<"language" | "switchLanguage" | "light" | "dark", string>;
}) {
  return (
    <div className="preferences">
      <PreferenceSelect label={labels.language} name="locale" value={locale} action={selectLocale}
        apply={labels.switchLanguage} includePath icon={<Globe2 size={16} />}>
        {locales.map((code) => <option key={code} value={code} lang={code} aria-label={code.toUpperCase() + " " + localeNames[code]}>{code.toUpperCase()}</option>)}
      </PreferenceSelect>
      <form action={selectTheme} className="theme-switch">
        <button className="theme-to-dark" type="submit" name="theme" value="dark" aria-label={labels.dark} title={labels.dark}>
          <Moon size={19} aria-hidden="true" />
        </button>
        <button className="theme-to-light" type="submit" name="theme" value="light" aria-label={labels.light} title={labels.light}>
          <Sun size={19} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
