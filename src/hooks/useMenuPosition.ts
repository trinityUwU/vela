// Repositionne un menu contextuel pour qu'il reste entièrement visible : ancré sur le curseur,
// rabattu vers l'intérieur si débordement, sans jamais sortir de l'écran.
import { useLayoutEffect, useRef, useState } from "react";

const MARGIN = 8;

export function useMenuPosition(x: number, y: number): {
  ref: React.RefObject<HTMLDivElement | null>;
  pos: { left: number; top: number };
} {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.max(MARGIN, Math.min(x, vw - width - MARGIN));
    const top = Math.max(MARGIN, Math.min(y, vh - height - MARGIN));
    setPos({ left, top });
  }, [x, y]);

  return { ref, pos };
}
