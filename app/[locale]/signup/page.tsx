import { selectDestination, workspacePath } from "@/lib/auth/destination";
import { headers } from "next/headers";
import { signupSiteKey } from "@/lib/auth/turnstile";
import { notFound, redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthScreen } from "@/components/auth/auth-screen";
import { isLocale } from "@/i18n/config";
import { verifiedUserId } from "@/lib/auth/session";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale });
  return { title: t("signup") + " | Jobvion", robots: { index: false, follow: false } };
}

export default async function Signup({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const destination = selectDestination((await searchParams).next);
  if (await verifiedUserId()) redirect(workspacePath(locale, destination));
  const nonce = (await headers()).get("x-jobvion-nonce") ?? undefined;
  return <AuthScreen destination={destination} locale={locale} mode="signup" siteKey={signupSiteKey()} nonce={nonce} />;
}
