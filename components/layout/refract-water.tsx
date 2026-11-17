"use client";

import { useEffect, useRef } from "react";

export function RefractWater() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const activation = new AbortController();
    let active = true;
    let cancelStart: (() => void) | undefined;
    let cleanup: (() => void) | undefined;
    const start = () => {
      void import("@/lib/refract/water").then(({ mountRefractWater }) => {
        if (active && canvas.current) cleanup = mountRefractWater(canvas.current);
      }).catch(() => {
        // The CSS pool is also available without the animation.
      });
    };
    const schedule = () => {
      activation.abort();
      if (typeof window.requestIdleCallback === "function") {
        const id = window.requestIdleCallback(start, { timeout: 1800 });
        cancelStart = () => window.cancelIdleCallback(id);
      } else {
        const id = window.setTimeout(start, 700);
        cancelStart = () => window.clearTimeout(id);
      }
    };
    if (window.matchMedia("(max-width: 760px)").matches) {
      for (const event of ["pointerdown", "scroll", "keydown"]) {
        window.addEventListener(event, schedule, { passive: true, signal: activation.signal });
      }
    } else {
      schedule();
    }
    return () => {
      active = false;
      activation.abort();
      cancelStart?.();
      cleanup?.();
    };
  }, []);

  return (
    <div className="refract-pool" aria-hidden="true">
      <canvas ref={canvas} className="refract-water" />
      <div className="refract-wall" />
    </div>
  );
}
