// Wrappers typés de la recherche avancée (F05).
import { invoke } from "@tauri-apps/api/core";
import type { DirEntry } from "../types";

export interface SearchCriteria {
  root: string;
  recursive: boolean;
  hidden: boolean;
  name: string;
  content: string;
  extensions: string[];
  sizeMin: number | null;
  sizeMax: number | null;
  after: number | null;
  before: number | null;
}

export function searchAdvanced(criteria: SearchCriteria): Promise<DirEntry[]> {
  return invoke<DirEntry[]>("search_advanced", { criteria });
}
