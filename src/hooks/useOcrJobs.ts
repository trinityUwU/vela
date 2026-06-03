// Écoute les événements OCR (ocr-progress) et maintient la liste des jobs pour le panneau d'activité.
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { OcrJob } from "../types";

const DISMISS_DELAY_MS = 6000;

export function useOcrJobs() {
  const [jobs, setJobs] = useState<Map<string, OcrJob>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const unlisten = listen<OcrJob>("ocr-progress", ({ payload: job }) => {
      setJobs((prev) => new Map(prev).set(job.id, job));
      if (job.status === "done" || job.status === "error") {
        const existing = timers.current.get(job.id);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setJobs((prev) => { const next = new Map(prev); next.delete(job.id); return next; });
          timers.current.delete(job.id);
        }, DISMISS_DELAY_MS);
        timers.current.set(job.id, t);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return { jobs };
}
