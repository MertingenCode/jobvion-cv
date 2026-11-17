"use client";

import { useParams } from "next/navigation";
import { isLocale } from "@/i18n/config";
import en from "@/messages/en.json";
import tr from "@/messages/tr.json";
import de from "@/messages/de.json";
import fr from "@/messages/fr.json";
import es from "@/messages/es.json";
import it from "@/messages/it.json";
import pt from "@/messages/pt.json";
import nl from "@/messages/nl.json";
import "./globals.css";

const messages = { en, tr, de, fr, es, it, pt, nl };

export default function GlobalError({ reset }: { reset: () => void }) {
  const requested = useParams()?.locale;
  const locale = isLocale(requested) ? requested : "en";
  const t = messages[locale];
  return (
    <html lang={locale}>
      <body><main className="container workspace">
        <h1>{t.genericError}</h1>
        <p className="lede">{t.errorText}</p>
        <button className="button button-primary" type="button" onClick={reset}>{t.retry}</button>
      </main></body>
    </html>
  );
}
