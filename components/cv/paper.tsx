"use client";

import { useEffect, useRef, useState } from "react";
import { renderCv } from "@/lib/cv/document";
import { cvFontFace, cvFontPath, cvStyles } from "@/lib/cv/styles";
import type { CvChoice, Profile } from "@/lib/cv/model";
import type { Template } from "@/lib/cv/templates";

export function CvPaperStyles() {
  return <style>{cvFontFace(cvFontPath) + cvStyles}</style>;
}

export function CvPaper({ profile, choice, template, photo }: {
  profile: Profile; choice: CvChoice; template: Template; photo?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const document = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ scale: .55, height: 620 });
  useEffect(() => {
    const outer = frame.current;
    const inner = document.current;
    if (!outer || !inner) return;
    const measure = () => {
      const paper = inner.firstElementChild;
      if (!(paper instanceof HTMLElement) || !paper.offsetWidth) return;
      const scale = Math.min(1, outer.clientWidth / paper.offsetWidth);
      const height = Math.ceil(paper.offsetHeight * scale);
      setSize((current) => current.scale === scale && current.height === height ? current : { scale, height });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(inner);
    measure();
    return () => observer.disconnect();
  }, [choice.paper]);

  return <div className="cv-preview-viewport" ref={frame} style={{ height: size.height }}>
    <div ref={document} className="cv-preview-page" style={{ transform: `scale(${size.scale})` }}
      dangerouslySetInnerHTML={{ __html: renderCv(profile, choice, template, photo) }} />
  </div>;
}
