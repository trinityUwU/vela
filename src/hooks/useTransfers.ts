// Écoute les événements de transfert Rust (copie/déplacement) et maintient les jobs en cours.
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { TransferJob, TransferStatus } from "../types";

interface RawPayload {
  job_id: string;
  kind: "copy" | "move";
  name: string;
  current: number;
  total: number;
  status: TransferStatus;
  error?: string;
}

const DISMISS_DELAY_MS = 6000;

export function useTransfers() {
  const [jobs, setJobs] = useState<Map<string, TransferJob>>(new Map());
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const unlistenP = listen<RawPayload>("transfer-progress", ({ payload: p }) => {
      const job: TransferJob = {
        id: p.job_id,
        kind: p.kind,
        name: p.name,
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

      if (p.status === "done" || p.status === "error" || p.status === "cancelled") {
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
