"use client";

import { useEffect, useRef } from "react";
import { mountRefractWater } from "@/lib/refract/water";

export function RefractWater() {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvas.current) return mountRefractWater(canvas.current);
  }, []);

  return (
    <div className="refract-pool" aria-hidden="true">
      <canvas ref={canvas} className="refract-water" />
      <div className="refract-wall" />
    </div>
  );
}
