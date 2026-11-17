import type { Metadata } from "next";
import { locales,type Locale } from "@/i18n/config";
import { readEnv } from "@/lib/env";

export function marketingMetadata(locale:Locale,path:string,title:string,description:string,hreflang:readonly Locale[]=locales):Metadata {
  const origin=readEnv().APP_ORIGIN;
  const canonical=origin+"/"+locale+path;
  const languages=Object.fromEntries(hreflang.map((code)=>[code,origin+"/"+code+path]));
  return {title:title+" | Jobvion",description,alternates:{canonical,languages:{...languages,"x-default":origin+"/en"+path}},
    openGraph:{type:"website",siteName:"Jobvion",url:canonical,title,description,images:[origin+"/"+locale+"/opengraph-image"]}};
}
