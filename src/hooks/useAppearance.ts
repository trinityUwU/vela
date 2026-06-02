// Personnalisation visuelle : couleur d'accent + densité (taille de base rem). Persisté localStorage.
import { useCallback, useEffect, useState } from "react";

export type Density = "compact" | "cozy" | "comfortable";

export interface Appearance {
  accent: string;
  density: Density;
}

export const ACCENT_PRESETS: { key: string; hex: string }[] = [
  { key: "blue", hex: "#6ea8fe" },
  { key: "violet", hex: "#b18cfc" },
  { key: "emerald", hex: "#4ade80" },
  { key: "amber", hex: "#fbbf24" },
  { key: "rose", hex: "#f87a8e" },
  { key: "cyan", hex: "#38d4d4" },
];

const DENSITY_PX: Record<Density, number> = { compact: 14, cozy: 15, comfortable: 16 };
const LS_KEY = "vela-appearance";
const DEFAULTS: Appearance = { accent: "#6ea8fe", density: "cozy" };

function load(): Appearance {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULTS;
}

// Assombrit une couleur hex vers le fond (pour --color-accent-dim).
function darken(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * factor);
  const g = Math.round(((n >> 8) & 255) * factor);
  const b = Math.round((n & 255) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export function useAppearance() {
  const [appearance, setAppearance] = useState<Appearance>(load);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--color-accent", appearance.accent);
    root.style.setProperty("--color-accent-dim", darken(appearance.accent, 0.55));
    root.style.fontSize = `${DENSITY_PX[appearance.density]}px`;
    try { localStorage.setItem(LS_KEY, JSON.stringify(appearance)); } catch { /* ignore */ }
  }, [appearance]);

  const setAccent = useCallback((accent: string) => setAppearance((a) => ({ ...a, accent })), []);
  const setDensity = useCallback((density: Density) => setAppearance((a) => ({ ...a, density })), []);

  return { appearance, setAccent, setDensity };
}
