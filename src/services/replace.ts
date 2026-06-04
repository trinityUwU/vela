// Wrappers typés du rechercher & remplacer multi-fichiers (F06).
import { invoke } from "@tauri-apps/api/core";

export interface ReplaceCriteria {
  root: string;
  find: string;
  replace: string;
  isRegex: boolean;
  caseSensitive: boolean;
  wholeWord: boolean;
  extensions: string[];
}

export interface Occurrence {
  line: number;
  before: string;
  after: string;
}

export interface FileMatches {
  path: string;
  count: number;
  samples: Occurrence[];
}

export interface Original {
  path: string;
  content: string;
}

export interface ApplyReport {
  files: number;
  count: number;
  originals: Original[];
}

export function searchReplacePreview(criteria: ReplaceCriteria): Promise<FileMatches[]> {
  return invoke<FileMatches[]>("search_replace_preview", { criteria });
}

export function searchReplaceApply(criteria: ReplaceCriteria, files: string[]): Promise<ApplyReport> {
  return invoke<ApplyReport>("search_replace_apply", { criteria, files });
}
