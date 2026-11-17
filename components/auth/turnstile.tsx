"use client";

import { useEffect, useRef } from "react";
import Script from "next/script";

type TurnstileApi = {
  render: (target: HTMLElement, options: Record<string, string>) => string;
  reset: (widget: string) => void;
  remove: (widget: string) => void;
};

function api() {
  return (window as Window & { turnstile?: TurnstileApi }).turnstile;
}

export function Turnstile({ siteKey, nonce, pending }: { siteKey: string; nonce?: string; pending: boolean }) {
  const target = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const submitted = useRef(false);
  useEffect(() => () => {
    if (widget.current) api()?.remove(widget.current);
    widget.current = undefined;
  }, []);
  useEffect(() => {
    if (!pending && submitted.current && widget.current) api()?.reset(widget.current);
    submitted.current = pending;
  }, [pending]);
  return <>
    <div ref={target} />
    <Script nonce={nonce} src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      strategy="afterInteractive" onReady={() => {
        if (!target.current || widget.current) return;
        widget.current = api()?.render(target.current, { sitekey: siteKey, size: "flexible", theme: "auto" });
      }} />
  </>;
}
