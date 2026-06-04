// Repositionne un menu contextuel pour qu'il reste entièrement visible : ancré sur le curseur,
// rabattu vers l'intérieur si débordement, jamais hors écran. Renvoie un maxHeight borné au viewport
// (scroll si plus haut que l'écran). Un ResizeObserver re-clampe sur tout reflow tardif (chargement
// de police, contenu async) — sinon une mesure trop courte laisse le menu déborder.
import { useLayoutEffect, useRef, useState } from "react";

const MARGIN = 8;

interface MenuStyle {
  left: number;
  top: number;
  maxHeight: number;
}

export function useMenuPosition(x: number, y: number): {
  ref: React.RefObject<HTMLDivElement | null>;
  style: MenuStyle;
} {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<MenuStyle>({ left: x, top: y, maxHeight: 9999 });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const clamp = (): void => {
      const root = document.documentElement;
      const vw = root.clientWidth;
      const vh = root.clientHeight;
      const maxHeight = vh - MARGIN * 2;
      const rect = el.getBoundingClientRect();
      const height = Math.min(rect.height, maxHeight);
      const left = Math.max(MARGIN, Math.min(x, vw - rect.width - MARGIN));
      const top = Math.max(MARGIN, Math.min(y, vh - height - MARGIN));
      setStyle((prev) =>
        prev.left === left && prev.top === top && prev.maxHeight === maxHeight
          ? prev
          : { left, top, maxHeight },
      );
    };
    clamp();
    const ro = new ResizeObserver(clamp);
    ro.observe(el);
    return () => ro.disconnect();
  }, [x, y]);

  return { ref, style };
}
