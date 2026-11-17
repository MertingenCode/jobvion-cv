import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { routeLocale } from "@/lib/admin/ui";
import { cvSession } from "@/lib/cv/data";
import { readEnv } from "@/lib/env";
import { serviceSupabase } from "@/lib/supabase/admin";
import { ApplicationEditor } from "@/components/application/editor";

export const metadata={robots:{index:false,follow:false}};
export default async function Application({params,searchParams}:{params:Promise<{locale:string}>;searchParams:Promise<{mode?:string}>}) {
  const locale=await routeLocale(params);
  const session = await cvSession();
  if(!session)redirect(`/${locale}/login`);
  const focus = (await searchParams).mode === "letter" ? "letter" : "application";
  const t = await getTranslations({locale,namespace:focus === "letter" ? "authFlow" : "release"});
  const recent = readEnv().SUPABASE_SERVICE_ROLE_KEY
    ? (await serviceSupabase().from("job_matches").select("id,report").eq("user_id", session.id)
      .order("created_at", { ascending: false }).limit(25)).data ?? [] : [];
  return <section className="container cv-workspace"><h1>{t(focus === "letter" ? "aiLetter" : "application")}</h1><ApplicationEditor key={focus} focus={focus} locale={locale} recent={recent.map(({id,report}) => ({id, title: typeof report?.position === "string" ? report.position : ""}))}/></section>;
}
