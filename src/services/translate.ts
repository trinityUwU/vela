// Wrappers traduction locale (Argos Translate). Capacités + traduction texte/fichier + install paquets.
import { invoke } from "@tauri-apps/api/core";

export interface TranslateCapabilities {
  available: boolean;
  langs: string[];
}

export function translateCapabilities(): Promise<TranslateCapabilities> {
  return invoke("translate_capabilities");
}

export function translateText(text: string, fromLang: string, toLang: string): Promise<string> {
  return invoke("translate_text", { text, fromLang, toLang });
}

export function translateInstallLang(fromLang: string, toLang: string): Promise<void> {
  return invoke("translate_install_lang", { fromLang, toLang });
}

export function translateFile(path: string, fromLang: string, toLang: string): Promise<string> {
  return invoke("translate_file", { path, fromLang, toLang });
}

export const LANGUAGES: { code: string; name: string }[] = [
  { code: "en", name: "Anglais" },
  { code: "fr", name: "Français" },
  { code: "es", name: "Espagnol" },
  { code: "de", name: "Allemand" },
  { code: "it", name: "Italien" },
  { code: "pt", name: "Portugais" },
  { code: "nl", name: "Néerlandais" },
  { code: "ru", name: "Russe" },
  { code: "zh", name: "Chinois" },
  { code: "ja", name: "Japonais" },
  { code: "ar", name: "Arabe" },
  { code: "pl", name: "Polonais" },
];
