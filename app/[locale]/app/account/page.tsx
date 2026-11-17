import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { routeLocale } from "@/lib/admin/ui";
import { cvSession } from "@/lib/cv/data";
import { policyVersion } from "@/lib/privacy/policies";
import { AccountControls } from "@/components/privacy/account";

export const metadata={robots:{index:false,follow:false}};
export default async function Account({params}:{params:Promise<{locale:string}>}){
  const locale=await routeLocale(params),session=await cvSession();
  if(!session)redirect(`/${locale}/login`);
  const t=await getTranslations({locale,namespace:"release"});
  const [acceptance,deletion]=await Promise.all([
    session.db.from("policy_acceptance").select("version").eq("user_id",session.id).eq("version",policyVersion).maybeSingle(),
    session.db.from("account_deletions").select("due_at").eq("user_id",session.id).maybeSingle(),
  ]);
  return <section className="container cv-workspace"><h1>{t("account")}</h1>
    {acceptance.error||deletion.error?<p role="status">{t("unavailable")}</p>:
    <AccountControls locale={locale} accepted={Boolean(acceptance.data)} deleteAt={deletion.data?.due_at??null}/>}</section>;
}
