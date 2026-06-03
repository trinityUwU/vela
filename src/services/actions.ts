// Wrappers des actions intelligentes (fusion CSV, rangement de dossier).
import { invoke } from "@tauri-apps/api/core";

export interface MoveRec {
  from: string;
  to: string;
}

export function mergeCsv(inputs: string[]): Promise<string> {
  return invoke("merge_csv", { inputs });
}

export function organizeDir(path: string, by: "type" | "date"): Promise<MoveRec[]> {
  return invoke("organize_dir", { path, by });
}
