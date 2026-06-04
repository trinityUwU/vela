// Wrappers typés de la boîte à outils PDF (F12).
import { invoke } from "@tauri-apps/api/core";

export function pdfMerge(paths: string[], dest: string): Promise<string> {
  return invoke<string>("pdf_merge", { paths, dest });
}

export function pdfExtractPages(path: string, ranges: string): Promise<string> {
  return invoke<string>("pdf_extract_pages", { path, ranges });
}

export function pdfRotate(path: string, degrees: number): Promise<string> {
  return invoke<string>("pdf_rotate", { path, degrees });
}
