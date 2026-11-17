import { emptyEntry, initialProfile, type Profile } from "./model";
import type { Locale } from "@/i18n/config";

const copy = {
  en: ["Product Designer", "Digital Designer", "Visual Communication Design", "Designs accessible digital products from research through release.", "Redesigned the onboarding flow, tested prototypes with users and documented accessible form states.", "Built a component library and prepared handoff specifications for engineering."],
  tr: ["Ürün Tasarımcısı", "Dijital Tasarımcı", "Görsel İletişim Tasarımı", "Kullanıcı araştırmasından yayına kadar erişilebilir dijital ürünler tasarlar.", "Üyelik akışını yeniledi, prototipleri kullanıcılarla test etti ve erişilebilir form durumlarını belgeledi.", "Bileşen kütüphanesi oluşturdu ve geliştiriciler için tasarım teslim dokümanlarını hazırladı."],
  de: ["Produktdesignerin", "Digitaldesignerin", "Visuelle Kommunikation", "Gestaltet barrierefreie digitale Produkte von der Forschung bis zur Veröffentlichung.", "Überarbeitete das Onboarding, testete Prototypen und dokumentierte barrierefreie Formulare.", "Baute eine Komponentenbibliothek auf und erstellte Spezifikationen für die Entwicklung."],
  fr: ["Designer produit", "Designer numérique", "Communication visuelle", "Conçoit des produits numériques accessibles, de la recherche au lancement.", "A repensé l’inscription, testé les prototypes et documenté les formulaires accessibles.", "A créé une bibliothèque de composants et les spécifications pour le développement."],
  es: ["Diseñadora de producto", "Diseñadora digital", "Comunicación visual", "Diseña productos digitales accesibles, desde la investigación hasta el lanzamiento.", "Rediseñó el registro, probó prototipos y documentó los estados de los formularios.", "Creó una biblioteca de componentes y preparó especificaciones para desarrollo."],
  it: ["Designer di prodotto", "Designer digitale", "Comunicazione visiva", "Progetta prodotti digitali accessibili, dalla ricerca al lancio.", "Ha riprogettato la registrazione, testato prototipi e documentato gli stati dei moduli.", "Ha creato una libreria di componenti e preparato le specifiche per lo sviluppo."],
  pt: ["Designer de produto", "Designer digital", "Comunicação visual", "Concebe produtos digitais acessíveis, da pesquisa ao lançamento.", "Redesenhou o registo, testou protótipos e documentou os estados dos formulários.", "Criou uma biblioteca de componentes e preparou especificações para desenvolvimento."],
  nl: ["Productontwerper", "Digitaal ontwerper", "Visuele communicatie", "Ontwerpt toegankelijke digitale producten, van onderzoek tot lancering.", "Vernieuwde de aanmelding, testte prototypes en legde toegankelijke formulierstatussen vast.", "Bouwde een componentbibliotheek en maakte specificaties voor ontwikkelaars."],
} as const;

export function sampleProfile(locale: Locale): Profile {
  const [title, previous, degree, summary, currentWork, previousWork] = copy[locale];
  return {
    ...initialProfile, name: "Deniz Kaya", title, email: "deniz@example.com", location: "İstanbul",
    summary,
    experience: [
      { ...emptyEntry, title, organization: "Studio North", start: "2022-05", detail: currentWork },
      { ...emptyEntry, title: previous, organization: "Forma Lab", start: "2019-06", end: "2022-04", detail: previousWork },
    ],
    education: [{ ...emptyEntry, title: degree, organization: "Mimar Sinan G.S.Ü.", start: "2015-09", end: "2019-06" }],
    skills: ["Figma", "Design systems", "Prototyping", "WCAG", "HTML", "CSS"],
  };
}
