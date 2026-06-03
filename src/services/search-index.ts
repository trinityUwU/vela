// Recherche globale instantanée sur l'index mémoire des noms de fichiers.
import { invoke } from "@tauri-apps/api/core";
import type { DirEntry } from "../types";

interface GlobalResult {
  path: string;
  name: string;
  is_dir: boolean;
  extension: string;
}

export function indexRefresh(): Promise<void> {
  return invoke("index_refresh");
}

export async function globalSearch(query: string, limit: number): Promise<DirEntry[]> {
  const r = await invoke<GlobalResult[]>("global_search", { query, limit });
  return r.map((x) => ({ ...x, size: 0, modified: 0 }));
}
