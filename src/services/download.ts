// Wrappers typés autour des commandes download du backend Rust (yt-dlp/spotdl).
import { invoke } from "@tauri-apps/api/core";
import type { DownloadCapabilities, DownloadInfo } from "../types";

export function capabilities(): Promise<DownloadCapabilities> {
  return invoke<DownloadCapabilities>("download_capabilities");
}

export function probe(url: string): Promise<DownloadInfo> {
  return invoke<DownloadInfo>("download_probe", { url });
}

export interface DownloadStartOptions {
  jobId: string;
  url: string;
  formatId?: string;
  destDir: string;
  audioOnly: boolean;
  audioFormat?: string;
  subLangs?: string[];
  isSpotify: boolean;
}

export function start(o: DownloadStartOptions): Promise<void> {
  return invoke("download_start", {
    jobId: o.jobId,
    url: o.url,
    formatId: o.formatId ?? null,
    destDir: o.destDir,
    audioOnly: o.audioOnly,
    audioFormat: o.audioFormat ?? null,
    subLangs: o.subLangs ?? null,
    isSpotify: o.isSpotify,
  });
}

export function cancel(jobId: string): Promise<void> {
  return invoke("download_cancel", { jobId });
}
