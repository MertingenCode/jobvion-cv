"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useRef } from "react";

export function MobileNavigation({ label, links }: {
  label: string;
  links: readonly { href: string; label: string }[];
}) {
  const disclosure = useRef<HTMLDetailsElement>(null);
  const trigger = useRef<HTMLElement>(null);

  return (
    <details className="mobile-navigation" ref={disclosure} onKeyDown={(event) => {
      if (event.key === "Escape" && disclosure.current?.open) {
        disclosure.current.open = false;
        trigger.current?.focus();
      }
    }}>
      <summary ref={trigger} aria-label={label}>
        <Menu className="mobile-navigation-menu" size={22} aria-hidden="true" />
        <X className="mobile-navigation-close" size={22} aria-hidden="true" />
      </summary>
      <nav className="mobile-navigation-links" aria-label={label}>
        {links.map(({ href, label }) => (
          <Link key={href} href={href} onClick={(event) => {
            if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && disclosure.current) {
              disclosure.current.open = false;
            }
          }}>{label}</Link>
        ))}
      </nav>
    </details>
  );
}
