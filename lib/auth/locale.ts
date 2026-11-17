import "server-only";
import { cookies } from "next/headers";
import { isLocale, localeCookie } from "@/i18n/config";
import { readEnv } from "@/lib/env";
import { preferenceCookie } from "@/lib/security/preferences";
import { serverSupabase } from "@/lib/supabase/server";

type Client = NonNullable<Awaited<ReturnType<typeof serverSupabase>>>;

export async function reconcileLocale(supabase: Client, shownLocale: string, accountLocale: unknown) {
  const jar = await cookies();
  const saved = jar.get(localeCookie)?.value;
  const selected = isLocale(saved) ? saved : isLocale(accountLocale) ? accountLocale : shownLocale;
  if (isLocale(selected)) {
    jar.set(localeCookie, selected, preferenceCookie(readEnv().APP_ORIGIN));
    if (accountLocale !== selected) await supabase.auth.updateUser({ data: { jobvion_locale: selected } });
  }
}
