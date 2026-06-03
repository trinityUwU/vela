// Wrappers typés autour de la conversion universelle (images/documents/pdf).
import { invoke } from "@tauri-apps/api/core";

export interface ConvertCapabilities {
  pandoc: boolean;
  libreoffice: boolean;
}

export function convertCapabilities(): Promise<ConvertCapabilities> {
  return invoke("convert_capabilities");
}

export function convertTargets(path: string): Promise<string[]> {
  return invoke("convert_targets", { path });
}

export function convertFile(input: string, target: string): Promise<string> {
  return invoke("convert_file", { input, target });
}
