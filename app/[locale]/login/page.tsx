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
  return { title: t("login") + " | Jobvion", robots: { index: false, follow: false } };
}

export default async function Login({ params, searchParams }: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  if (await verifiedUserId()) redirect(`/${locale}/app`);
  const nonce = (await headers()).get("x-jobvion-nonce") ?? undefined;
  return <AuthScreen siteKey={signupSiteKey()} nonce={nonce} locale={locale} mode="login" status={(await searchParams).status} />;
}
