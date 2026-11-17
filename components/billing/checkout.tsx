"use client";
import Script from "next/script";
import { useState } from "react";
import { useTranslations } from "next-intl";

type PaddleClient={Environment:{set:(mode:"sandbox")=>void};Initialize:(settings:{
  token:string;checkout:{settings:{locale:string;successUrl:string;allowLogout:boolean}}
})=>void;};

export function CheckoutWidget({token,sandbox,locale,successUrl,nonce}:{
  token:string;sandbox:boolean;locale:string;successUrl:string;nonce?:string
}){
  const t=useTranslations("release"),[failed,setFailed]=useState(false);
  return <>
    <Script src="https://cdn.paddle.com/paddle/v2/paddle.js" nonce={nonce} onError={()=>setFailed(true)} onReady={()=>{
      const paddle=(window as Window & {Paddle?:PaddleClient}).Paddle;
      if(!paddle){setFailed(true);return;}
      try{if(sandbox)paddle.Environment.set("sandbox");
        paddle.Initialize({token,checkout:{settings:{locale,successUrl,allowLogout:false}}});
      }catch{setFailed(true);}
    }}/>
    {failed&&<p role="status">{t("unavailable")}</p>}
  </>;
}
