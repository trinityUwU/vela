// Actions proposées selon le type collectif de la sélection. Pur, testable.
import type { DirEntry } from "../types";
import { previewKind } from "./file-kind";

export type SmartActionId = "images-to-pdf" | "merge-csv" | "organize-type" | "organize-date";

export interface SmartAction {
  id: SmartActionId;
  label: string;
}

const CSV = new Set(["csv", "tsv"]);

export function smartActions(entries: DirEntry[]): SmartAction[] {
  if (entries.length === 0) return [];
  const files = entries.filter((e) => !e.is_dir);
  const out: SmartAction[] = [];
  if (files.length >= 2 && files.every((e) => previewKind(e.extension) === "image")) {
    out.push({ id: "images-to-pdf", label: `Créer un PDF (${files.length} images)` });
  }
  if (files.length >= 2 && files.every((e) => CSV.has(e.extension.toLowerCase()))) {
    out.push({ id: "merge-csv", label: `Fusionner ${files.length} CSV` });
  }
  if (entries.length === 1 && entries[0].is_dir) {
    out.push({ id: "organize-type", label: "Ranger par type" });
    out.push({ id: "organize-date", label: "Ranger par date" });
  }
  return out;
}
