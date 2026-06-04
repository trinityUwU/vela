// Wrappers typés du partage LAN éphémère (F22).
import { invoke } from "@tauri-apps/api/core";

export interface ShareInfo {
  url: string;
  qr_svg: string;
  file_name: string;
}

export function shareStart(paths: string[]): Promise<ShareInfo> {
  return invoke<ShareInfo>("share_start", { paths });
}

export function shareStop(): Promise<void> {
  return invoke("share_stop");
}
