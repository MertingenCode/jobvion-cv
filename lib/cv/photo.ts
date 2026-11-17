import sharp from "sharp";
import { normalizedPhotoMaxBytes, photoMaxBytes } from "@/lib/cv/model";

function photoFormat(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

export async function normalizePortrait(bytes: Uint8Array, type: string) {
  if (!bytes.length || bytes.length > photoMaxBytes) return null;
  const format = photoFormat(bytes);
  if (!format || type !== "image/" + format) return null;
  try {
    const image = sharp(bytes, { limitInputPixels: 20_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) !== 1) return null;
    const normalized = await image.rotate().resize(600, 720, { fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#fff" }).jpeg({ quality: 86 }).toBuffer();
    return normalized.length <= normalizedPhotoMaxBytes ? normalized : null;
  } catch {
    return null;
  }
}
