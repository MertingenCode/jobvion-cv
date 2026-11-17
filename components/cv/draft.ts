"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/cv/model";
import { cvPost, listenForDraftSave, responseError, type CvErrorCode } from "@/lib/cv/client";

type Status = CvErrorCode | "saved" | "saving" | "waiting";

export function useProfileDraft(initial: Profile, initialRevision: number) {
  const [profile, setProfile] = useState(initial);
  const [status, setStatus] = useState<Status>("saved");
  const latest = useRef(initial);
  const persisted = useRef(initial);
  const revision = useRef(initialRevision);
  const conflict = useRef(false);
  const pending = useRef<Promise<boolean> | null>(null);

  const flush = useCallback(function flushChanges(): Promise<boolean> {
    if (conflict.current) return Promise.resolve(false);
    if (pending.current) return pending.current.then((ok) => ok ? flushChanges() : false);
    if (latest.current === persisted.current) return Promise.resolve(true);

    const snapshot = latest.current;
    setStatus("saving");
    pending.current = (async () => {
      try {
        const response = await cvPost("/api/cv", { operation: "draft", profile: snapshot, revision: revision.current });
        if (!response.ok) {
          const message = await responseError(response);
          if (message === "conflict") conflict.current = true;
          setStatus(message);
          return false;
        }
        const saved = await response.json() as { revision?: unknown };
        if (typeof saved.revision !== "number" || !Number.isInteger(saved.revision)) throw new Error();
        revision.current = saved.revision;
        persisted.current = snapshot;
        setStatus(latest.current === snapshot ? "saved" : "waiting");
        return true;
      } catch {
        setStatus("unavailable");
        return false;
      } finally {
        pending.current = null;
      }
    })();
    return pending.current.then((ok) => ok ? flushChanges() : false);
  }, []);

  function update(value: Profile) {
    latest.current = value;
    setProfile(value);
    if (!conflict.current && !pending.current) setStatus("waiting");
  }

  useEffect(() => {
    if (profile === persisted.current || conflict.current) return;
    const timer = window.setTimeout(() => { void flush(); }, 750);
    return () => window.clearTimeout(timer);
  }, [profile, flush]);

  useEffect(() => {
    const unregister = listenForDraftSave(flush);
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current === persisted.current) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      unregister();
      window.removeEventListener("beforeunload", warn);
    };
  }, [flush]);

  return { profile, status, update, flush };
}
