import { emptyEntry, initialProfile } from "./model";
import type { Locale } from "@/i18n/config";

const roles = {
  en: "Product designer", tr: "Ürün tasarımcısı", de: "Produktdesignerin", fr: "Designer produit",
  es: "Diseñadora de producto", it: "Designer di prodotto", pt: "Designer de produto", nl: "Productontwerper",
};
const details = {
  en: "Designed accessible workflows and validated prototypes with users.",
  tr: "Erişilebilir iş akışları tasarladı ve prototipleri kullanıcılarla doğruladı.",
  de: "Entwarf barrierefreie Abläufe und testete Prototypen mit Nutzern.",
  fr: "A conçu des parcours accessibles et testé les prototypes avec des utilisateurs.",
  es: "Diseñó flujos accesibles y probó prototipos con usuarios.",
  it: "Ha progettato flussi accessibili e verificato i prototipi con gli utenti.",
  pt: "Criou fluxos acessíveis e testou protótipos com utilizadores.",
  nl: "Ontwierp toegankelijke processen en testte prototypes met gebruikers.",
};

export function sampleProfile(locale: Locale) {
  return {
    ...initialProfile, name: "Deniz Kaya", title: roles[locale], email: "deniz@example.com",
    summary: details[locale],
    experience: [{ ...emptyEntry, title: roles[locale], organization: "Studio North", start: "2021-04", detail: details[locale] }],
    skills: ["Figma", "HTML", "CSS"],
  };
}
