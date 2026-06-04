// Wrappers typés des commandes de modèles (F24).
import { invoke } from "@tauri-apps/api/core";

export interface Template {
  name: string;
  is_dir: boolean;
}

export function templateList(): Promise<Template[]> {
  return invoke<Template[]>("template_list");
}

export function templateInstantiate(name: string, destDir: string, newName: string): Promise<string> {
  return invoke<string>("template_instantiate", { name, destDir, newName });
}

export function saveAsTemplate(path: string, name: string): Promise<void> {
  return invoke("save_as_template", { path, name });
}
