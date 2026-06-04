// Aperçu vidéo au survol (F18) : génère un storyboard paresseusement, lit les vignettes en base64
// et les fait défiler tant que la souris reste sur la tuile. Débounce + cache (par le backend).
import { useCallback, useEffect, useRef, useState } from "react";
import { videoStoryboard } from "../services/video";
import { readFileBase64 } from "../services/fs";

const FRAMES = 8;
const HOVER_DELAY = 400;
const CYCLE_MS = 500;

const cache = new Map<string, string[]>();

export function useHoverPreview(path: string, enabled: boolean) {
  const [frame, setFrame] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycler = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (cycler.current) clearInterval(cycler.current);
    timer.current = null; cycler.current = null;
    setFrame(null);
  }, []);

  const start = useCallback(() => {
    if (!enabled) return;
    timer.current = setTimeout(async () => {
      let frames = cache.get(path);
      if (!frames) {
        try {
          const paths = await videoStoryboard(path, FRAMES);
          frames = await Promise.all(paths.map(async (p) => `data:image/jpeg;base64,${await readFileBase64(p)}`));
          cache.set(path, frames);
        } catch {
          return;
        }
      }
      if (!frames.length) return;
      let i = 0;
      setFrame(frames[0]);
      cycler.current = setInterval(() => {
        i = (i + 1) % frames!.length;
        setFrame(frames![i]);
      }, CYCLE_MS);
    }, HOVER_DELAY);
  }, [path, enabled]);

  useEffect(() => stop, [stop]);
  return { frame, start, stop };
}
