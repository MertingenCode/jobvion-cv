"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BlogCover({ id, alt, turkish }: { id: string; alt: string | null; turkish: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const url = "/api/blog/cover/" + id;
  async function mutate(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    const form = event ? new FormData(event.currentTarget) : null;
    const file = form?.get("file");
    const description = form?.get("alt");
    if (form && (!(file instanceof File) || !file.size || typeof description !== "string")) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await fetch(url, file instanceof File && typeof description === "string" ? {
        method: "POST", body: file, headers: { "Content-Type": file.type, "X-Jobvion-Alt": encodeURIComponent(description) },
      } : { method: "DELETE" });
      if (!result.ok) throw new Error();
      setVersion((value) => value + 1);
      router.refresh();
      setMessage(turkish ? "Kaydedildi." : "Saved.");
    } catch {
      setMessage(turkish ? "Görsel kaydedilemedi." : "The cover could not be saved.");
    } finally {
      setBusy(false);
    }
  }
  return <section className="release-stack">
    <h2>{turkish ? "Kapak görseli" : "Cover image"}</h2>
    {alt && <Image className="article-cover" src={url + "?v=" + version} alt={alt} width={600} height={400} unoptimized />}
    <form onSubmit={mutate} className="release-stack">
      <label>{turkish ? "Görsel" : "Image"} <Input type="file" name="file" accept="image/jpeg,image/png,image/webp" required /></label>
      <label>{turkish ? "Alternatif metin" : "Alternative text"} <Input name="alt" maxLength={180} defaultValue={alt ?? ""} required /></label>
      <div className="studio-actions">
        <Button type="submit" disabled={busy}>{turkish ? "Görseli kaydet" : "Save image"}</Button>
        {alt && <Button type="button" variant="outline" disabled={busy} onClick={() => void mutate()}>{turkish ? "Görseli kaldır" : "Remove image"}</Button>}
      </div>
    </form>
    <p role="status">{message}</p>
  </section>;
}
