// Wrappers typés du traitement d'images par lot (F15).
import { invoke } from "@tauri-apps/api/core";

export interface BatchOptions {
  maxWidth: number | null;
  maxHeight: number | null;
  format: string | null;
  quality: number | null;
  stripExif: boolean;
  renamePattern: string | null;
  outSubdir: string;
}

export interface BatchProgress {
  done: number;
  total: number;
  current: string;
}

export function imagesBatch(paths: string[], options: BatchOptions): Promise<string> {
  return invoke<string>("images_batch", { paths, options });
}
