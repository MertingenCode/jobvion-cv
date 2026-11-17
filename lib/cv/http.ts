import { NextResponse } from "next/server";
import { readEnv } from "@/lib/env";

export class BodyTooLarge extends Error {}

export function cvSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return (origin === null || origin === readEnv().APP_ORIGIN) && request.headers.get("sec-fetch-site") !== "cross-site";
}

export async function readBytes(request: Pick<Request, "headers" | "body">, maximum: number) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maximum) throw new BodyTooLarge();
  if (!request.body) return Buffer.alloc(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maximum) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks, length);
  } finally {
    reader.releaseLock();
  }
}

export async function readCvJson(request: Request) {
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return null;
  try {
    return JSON.parse((await readBytes(request, 512 * 1024)).toString("utf8")) as unknown;
  } catch {
    return null;
  }
}

export const privateResponse = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };

export function cvError(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: privateResponse });
}

export function cvJson(value: unknown) {
  return NextResponse.json(value, { headers: privateResponse });
}
