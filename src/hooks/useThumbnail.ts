// Miniature d'image lazy : génère via IntersectionObserver, concurrence globale plafonnée à 4.
import { useEffect, useRef, useState } from "react";
import * as fs from "../services/fs";

const MAX_CONCURRENT = 4;
let active = 0;
const queue: (() => void)[] = [];

function schedule(task: () => Promise<void>): void {
  const run = () => {
    active++;
    task().finally(() => {
      active--;
      const next = queue.shift();
      if (next) next();
    });
  };
  if (active < MAX_CONCURRENT) run();
  else queue.push(run);
}

export function useThumbnail(path: string, enabled: boolean, max = 128) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    let cancelled = false;

    const obs = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        obs.disconnect();
        schedule(async () => {
          if (cancelled) return;
          try {
            const b64 = await fs.thumbnail(path, max);
            if (!cancelled) setSrc(`data:image/png;base64,${b64}`);
          } catch {
            if (!cancelled) setError(true);
          }
        });
      },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => { cancelled = true; obs.disconnect(); };
  }, [path, enabled, max]);

  return { ref, src, error };
}
