// Étiquettes couleur : palette sémantique + wrappers commandes Tauri.
import { invoke } from "@tauri-apps/api/core";

export interface TagColor {
  key: string;
  hex: string;
  label: string;
}

export const TAG_COLORS: TagColor[] = [
  { key: "red", hex: "#f87171", label: "Rouge" },
  { key: "orange", hex: "#fb923c", label: "Orange" },
  { key: "yellow", hex: "#facc15", label: "Jaune" },
  { key: "green", hex: "#4ade80", label: "Vert" },
  { key: "blue", hex: "#60a5fa", label: "Bleu" },
  { key: "purple", hex: "#c084fc", label: "Violet" },
  { key: "gray", hex: "#9ca3af", label: "Gris" },
];

export function hexFor(key: string | undefined): string | undefined {
  return key ? TAG_COLORS.find((c) => c.key === key)?.hex : undefined;
}

export function loadTags(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>("load_tags");
}

export function setTag(paths: string[], color: string): Promise<void> {
  return invoke("set_tag", { paths, color });
}
