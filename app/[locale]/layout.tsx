import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { getMessages, setRequestLocale } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { Shell } from "@/components/layout/shell";
import { readEnv } from "@/lib/env";
import { isLocale } from "@/i18n/config";
import { isTheme, themeCookie } from "@/lib/security/preferences";
import { verifiedUserId } from "@/lib/auth/session";
import "@fontsource-variable/funnel-display";
import "@fontsource-variable/funnel-sans";
import "@fontsource-variable/inter";
import "../globals.css";
import "../refract.css";

export function generateMetadata() {
  return { metadataBase: new URL(readEnv().APP_ORIGIN) };
}

export default async function LocaleLayout({ children, params }: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  // Next reads the request CSP and applies its nonce to the framework scripts.
  await headers();
  const value = (await cookies()).get(themeCookie)?.value;
  const theme = isTheme(value) ? value : "system";
  const [messages, user] = await Promise.all([getMessages(), verifiedUserId()]);
  return (
    <html lang={locale} data-theme={theme}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <Shell locale={locale} signedIn={Boolean(user)}>{children}</Shell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
