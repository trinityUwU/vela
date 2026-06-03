// Écoute les événements d'extraction Rust et maintient la liste des jobs en cours.
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { ExtractionJob, ExtractionStatus } from "../types";

interface RawPayload {
  job_id: string;
  archive_name: string;
  dest: string;
  current: number;
  total: number;
  status: ExtractionStatus;
  error?: string;
}

const DISMISS_DELAY_MS = 6000;

export function useExtractions(onComplete?: () => void) {
  const [jobs, setJobs] = useState<Map<string, ExtractionJob>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const unlistenP = listen<RawPayload>("extraction-progress", ({ payload: p }) => {
      const job: ExtractionJob = {
        id: p.job_id,
        archiveName: p.archive_name,
        dest: p.dest,
        current: p.current,
        total: p.total,
        status: p.status,
        error: p.error,
      };

      setJobs((prev) => {
        const next = new Map(prev);
        next.set(p.job_id, job);
        return next;
      });

      const terminal = ["done", "error", "cancelled"].includes(p.status);
      if (terminal) {
        if (p.status === "done") onCompleteRef.current?.();
        const existing = timers.current.get(p.job_id);
        if (existing) clearTimeout(existing);
        const t = setTimeout(() => {
          setJobs((prev) => { const next = new Map(prev); next.delete(p.job_id); return next; });
          timers.current.delete(p.job_id);
        }, DISMISS_DELAY_MS);
        timers.current.set(p.job_id, t);
      }
    });

    return () => {
      unlistenP.then((fn) => fn());
      timers.current.forEach(clearTimeout);
    };
  }, []);

  return { jobs };
}
