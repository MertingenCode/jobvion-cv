import { ImageResponse } from "next/og";

export const alt = "Jobvion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{
    width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "#143a2c", color: "#f5ffeb", fontSize: 108, gap: 28,
    fontWeight: 700,
  }}><svg viewBox="0 0 36 36" width="140" height="140">
    <path d="M11 11h8v9.6c0 4.1-2.5 6.4-6 6.4-2.3 0-4-1-5.2-2.8l2.7-2.5c.7 1 1.4 1.5 2.3 1.5 1.4 0 2.3-1 2.3-2.8v-5.6H11z" fill="#f5ffeb" />
    <path d="m20 18 3.1 4.7 5.8-9.9 3.1 1.8-8.6 14.1-5.4-8.8z" fill="#bdf478" />
  </svg><span>Jobvion</span></div>, size);
}
