import type { Locale } from "@/i18n/config";
import translated from "./guides-translations.json";

export const guides = [
  {
    slug: "read-a-job-posting",
    en: ["How to read a job posting", "Separate the responsibilities you can demonstrate from the requirements you need to clarify.", "Underline the recurring verbs and deliverables. If a role mentions onboarding, training, and documentation, look for one example where you helped someone learn a process.", "Mark any required license, language, location, or work authorization. When a requirement is unclear, write a short question for the recruiter before investing in a long application."],
    tr: ["İş ilanı nasıl okunur?", "Örnekle gösterebildiğin sorumlulukları ve açıklığa kavuşturman gereken şartları ayır.", "Tekrarlanan eylemleri ve beklenen çıktıları işaretle. İlanda işe alıştırma, eğitim ve dokümantasyon geçiyorsa birine bir süreci öğrettiğin somut bir örnek bul.", "Zorunlu lisans, dil, lokasyon ve çalışma izni şartlarını belirle. Belirsiz bir şart için başvuruyu hazırlamadan önce işe alım ekibine kısa bir soru yaz."],
  },
  {
    slug: "write-cv-bullets",
    en: ["Write CV bullets with evidence", "Start with the action, explain its scope, and add the outcome you can verify.", "Change 'Responsible for support' to 'Triaged refund requests and documented recurring billing issues for the product team' if that describes your work.", "Use totals, time saved, or customer outcomes when you have a source for the number. If you cannot substantiate a figure, name the deliverable or the team that used it."],
    tr: ["CV maddeleri somut örneklerle nasıl yazılır?", "Eylemle başla, kapsamını açıkla ve doğrulayabildiğin sonucu ekle.", "Yaptığın işi doğru anlatıyorsa 'Destekten sorumluydum' yerine 'İade taleplerini önceliklendirdim ve tekrarlanan ödeme sorunlarını ürün ekibi için belgeledim' yaz.", "Kaynağını gösterebildiğin sayıları kullan. Bir rakamı doğrulayamıyorsan teslim ettiğin çıktıyı veya onu kullanan ekibi belirt."],
  },
  {
    slug: "check-an-ats-friendly-pdf",
    en: ["Check a CV PDF before sending it", "Check whether the text and reading order survive PDF export.", "Select all text in your PDF and paste it into a plain text editor. Confirm that your name, headings, job titles, dates, and bullet points appear in reading order.", "Open the file at normal zoom and check line breaks, margins, and the last page. If the application portal asks for another file format, follow the portal instructions."],
    tr: ["CV PDF’si göndermeden önce nasıl kontrol edilir?", "PDF dışa aktarımından sonra metnin seçilebildiğini ve okuma sırasının korunduğunu kontrol et.", "PDF’deki metnin tamamını kopyalayıp düz metin editörüne yapıştır. Adının, başlıkların, görevlerin, tarihlerin ve maddelerin doğru sırada geldiğine bak.", "Dosyayı normal yakınlaştırmada açıp satır sonlarını, kenar boşluklarını ve son sayfayı kontrol et. Başvuru portalı başka dosya biçimi istiyorsa portalın talimatını izle."],
  },
  {
    slug: "write-a-short-cover-letter",
    en: ["Write a short cover letter", "Use one example to connect your experience to the employer’s needs.", "Name the role in the opening and identify a responsibility that interests you. In the next paragraph, describe a real project that shows how you handled similar work.", "Close with what you would like to discuss in an interview. Read the letter aloud and remove any sentence that could describe almost any applicant."],
    tr: ["Kısa bir ön yazı nasıl yazılır?", "Deneyimini işverenin ihtiyacına tek bir somut örnekle bağla.", "Girişte pozisyonu ve ilgini çeken bir sorumluluğu belirt. Sonraki paragrafta benzer bir işi nasıl yaptığını gösteren gerçek bir projeyi anlat.", "Mülakatta neyi konuşmak istediğini söyleyerek bitir. Ön yazını sesli oku ve neredeyse her adaya uyabilecek cümleleri çıkar."],
  },
  {
    slug: "prepare-an-application-checklist",
    en: ["A final checklist for job applications", "Review your documents, contact details, and submission in a consistent order.", "Confirm the employer and job title in both files. Check that dates agree across your CV and application form, and that any portfolio link opens in a signed-out browser.", "Name the file clearly, upload the requested format, and keep the submission confirmation. Save the vacancy text and your submitted files for interview preparation."],
    tr: ["İş başvurusu için son kontrol listesi", "Belgelerini, iletişim bilgilerini ve gönderim adımlarını her başvuruda aynı sırayla gözden geçir.", "Her iki dosyada işveren ve pozisyon adını doğrula. CV ve formdaki tarihlerin tutarlı olduğunu ve portfolyo bağlantısının oturum kapalıyken açıldığını kontrol et.", "Dosyaya anlaşılır bir ad ver, istenen biçimde yükle ve gönderim onayını sakla. Mülakata hazırlanmak için ilanı ve gönderdiğin belgeleri kaydet."],
  },
] as const;

export function localizedGuide(locale: Locale, slug: string) {
  const index = guides.findIndex((guide) => guide.slug === slug);
  if (index === -1) return null;
  return locale === "en" || locale === "tr" ? guides[index][locale] : translated[locale][index];
}
