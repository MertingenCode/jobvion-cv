"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isLocale, localeCookie } from "@/i18n/config";
import { readEnv } from "@/lib/env";
import { isTheme, preferenceCookie, themeCookie } from "@/lib/security/preferences";
import { serverSupabase } from "@/lib/supabase/server";

const localPath = z.string().max(2048).regex(/^\/(?![\/\\])[^\\\r\n]*$/);

export async function selectLocale(form: FormData) {
  const selected = form.get("locale");
  const path = localPath.safeParse(form.get("path"));
  if (!isLocale(selected) || !path.success) return;
  const url = new URL(path.data, readEnv().APP_ORIGIN);
  for (const key of ["code", "token_hash", "access_token", "refresh_token", "error_description"]) {
    url.searchParams.delete(key);
  }
  const [, current, ...segments] = url.pathname.split("/");
  if (!isLocale(current)) return;
  const jar = await cookies();
  jar.set(localeCookie, selected, preferenceCookie(readEnv().APP_ORIGIN));

  const supabase = await serverSupabase();
  if (supabase) {
    const { data } = await supabase.auth.getClaims();
    if (data?.claims.sub) await supabase.auth.updateUser({ data: { jobvion_locale: selected } });
  }

  redirect([ "", selected, ...segments ].join("/") + url.search);
}

export async function selectTheme(form: FormData) {
  const theme = form.get("theme");
  if (!isTheme(theme)) return;
  const jar = await cookies();
  jar.set(themeCookie, theme, preferenceCookie(readEnv().APP_ORIGIN));
}
