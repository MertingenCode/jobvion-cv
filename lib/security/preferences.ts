import type { CookieOptions } from "@supabase/ssr";

export const themeCookie = "jobvion-theme";
export const themes = ["system", "light", "dark"] as const;
export type Theme = (typeof themes)[number];

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && themes.some((theme) => theme === value);
}

export function preferenceCookie(appOrigin: string): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    secure: new URL(appOrigin).protocol === "https:",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  };
}
