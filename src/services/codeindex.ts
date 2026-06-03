// Wrappers CodeIndex : recherche sémantique de code (requête FR traduite en EN côté backend).
import { invoke } from "@tauri-apps/api/core";

export interface CodeHit {
  reading_order: number;
  relative_path: string;
  cluster: string;
  hot_score: number;
  relevance_score: number;
  summary: string | null;
  exports: string[];
  top_functions: string[];
}

export function codeindexAvailable(): Promise<boolean> {
  return invoke("codeindex_available");
}

export function codeindexSearch(project: string, question: string): Promise<CodeHit[]> {
  return invoke("codeindex_search", { project, question });
}

export function codeindexIndex(project: string): Promise<string> {
  return invoke("codeindex_index", { project });
}
