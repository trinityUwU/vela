// Wrappers OCR (tesseract). Capacités + extraction de texte.
import { invoke } from "@tauri-apps/api/core";

export interface OcrCapabilities {
  tesseract: boolean;
  langs: string[];
}

export function ocrCapabilities(): Promise<OcrCapabilities> {
  return invoke("ocr_capabilities");
}

export function ocrExtract(path: string, lang: string): Promise<string> {
  return invoke("ocr_extract", { path, lang });
}
