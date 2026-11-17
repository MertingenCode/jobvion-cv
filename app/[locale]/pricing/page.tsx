import { permanentRedirect } from "next/navigation";
import { routeLocale } from "@/lib/admin/ui";

export default async function Pricing({ params }: { params: Promise<{ locale: string }> }) {
  const locale = await routeLocale(params);
  permanentRedirect(`/${locale}#pricing`);
}
