// Wrappers des commandes terminal (PTY backend).
import { invoke } from "@tauri-apps/api/core";

export function termOpen(cwd: string, cols: number, rows: number): Promise<string> {
  return invoke<string>("term_open", { cwd, cols, rows });
}

export function termInput(id: string, data: string): Promise<void> {
  return invoke("term_input", { id, data });
}

export function termResize(id: string, cols: number, rows: number): Promise<void> {
  return invoke("term_resize", { id, cols, rows });
}

export function termClose(id: string): Promise<void> {
  return invoke("term_close", { id });
}
