// Wrappers du navigateur intégré (webviews enfants natives, une par onglet).
import { invoke } from "@tauri-apps/api/core";

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export async function browserCreate(id: string, url: string, b: Bounds): Promise<void> {
  return invoke("browser_create", { id, url, x: b.x, y: b.y, w: b.w, h: b.h });
}

export async function browserNavigate(id: string, url: string): Promise<void> {
  return invoke("browser_navigate", { id, url });
}

export async function browserShow(id: string, b: Bounds): Promise<void> {
  return invoke("browser_show", { id, x: b.x, y: b.y, w: b.w, h: b.h });
}

export async function browserHide(id: string): Promise<void> {
  return invoke("browser_hide", { id });
}

export async function browserEval(id: string, js: string): Promise<void> {
  return invoke("browser_eval", { id, js });
}

export async function browserClose(id: string): Promise<void> {
  return invoke("browser_close", { id });
}

export async function browserReset(): Promise<void> {
  return invoke("browser_reset");
}

export function normalizeUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[^\s]+\.[^\s]+$/.test(s)) return `https://${s}`;
  return `https://www.google.com/search?q=${encodeURIComponent(s)}`;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname || url;
  } catch {
    return url;
  }
}
