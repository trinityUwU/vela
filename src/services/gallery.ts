// Wrappers typés de la galerie (F14) : EXIF + palette de couleurs.
import { invoke } from "@tauri-apps/api/core";

export interface ExifField {
  label: string;
  value: string;
}

export function imageExif(path: string): Promise<ExifField[]> {
  return invoke<ExifField[]>("image_exif", { path });
}

export function imagePalette(path: string, count = 6): Promise<string[]> {
  return invoke<string[]>("image_palette", { path, count });
}
