import { ImageResponse } from "next/og";

export const alt = "Jobvion";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(<div style={{
    width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
    background: "linear-gradient(145deg, #d7e8ed, #72b5ca)", color: "#12364a", fontSize: 108,
    fontWeight: 700,
  }}><span>Jobvion</span></div>, size);
}
