// Wrappers typés autour des commandes media du backend Rust (ffmpeg/demucs).
import { invoke } from "@tauri-apps/api/core";
import type {
  MediaCapabilities,
  MediaProbe,
  StemsStatus,
  ImageOp,
} from "../types";

export function capabilities(): Promise<MediaCapabilities> {
  return invoke<MediaCapabilities>("media_capabilities");
}

export function probeMedia(path: string): Promise<MediaProbe> {
  return invoke<MediaProbe>("media_probe", { path });
}

// ── Audio ────────────────────────────────────────────────────────────────────
export function audioTrim(input: string, output: string, start: number, end: number): Promise<void> {
  return invoke("audio_trim", { input, output, start, end });
}

export function audioFade(input: string, output: string, fadeIn: number, fadeOut: number): Promise<void> {
  return invoke("audio_fade", { input, output, fadeIn, fadeOut });
}

export function audioNormalize(input: string, output: string): Promise<void> {
  return invoke("audio_normalize", { input, output });
}

export function audioConvert(input: string, output: string, bitrate?: string): Promise<void> {
  return invoke("audio_convert", { input, output, bitrate });
}

export function audioRemoveVocals(input: string, output: string): Promise<void> {
  return invoke("audio_remove_vocals", { input, output });
}

// ── Stems (demucs) ─────────────────────────────────────────────────────────────
export function stemsStatus(): Promise<StemsStatus> {
  return invoke<StemsStatus>("stems_status");
}

export function stemsSeparate(
  jobId: string,
  input: string,
  outputDir: string,
  twoStems?: string,
): Promise<void> {
  return invoke("stems_separate", { jobId, input, outputDir, twoStems });
}

export function stemsInstall(jobId: string): Promise<void> {
  return invoke("stems_install", { jobId });
}

export function stemsCancel(jobId: string): Promise<void> {
  return invoke("stems_cancel", { jobId });
}

// ── Image ──────────────────────────────────────────────────────────────────────
export function imageCrop(
  input: string,
  output: string,
  x: number,
  y: number,
  w: number,
  h: number,
): Promise<void> {
  return invoke("image_crop", { input, output, x, y, w, h });
}

export function imageRotate(input: string, output: string, degrees: number): Promise<void> {
  return invoke("image_rotate", { input, output, degrees });
}

export function imageFlip(input: string, output: string, horizontal: boolean): Promise<void> {
  return invoke("image_flip", { input, output, horizontal });
}

export function imageResize(
  input: string,
  output: string,
  width: number,
  height: number,
  keepAspect: boolean,
): Promise<void> {
  return invoke("image_resize", { input, output, width, height, keepAspect });
}

export function imageAdjust(
  input: string,
  output: string,
  brightness: number,
  contrast: number,
  saturation: number,
): Promise<void> {
  return invoke("image_adjust", { input, output, brightness, contrast, saturation });
}

export function imageConvert(input: string, output: string, quality?: number): Promise<void> {
  return invoke("image_convert", { input, output, quality });
}

/** Applique une séquence d'éditions accumulées en un seul fichier de sortie. */
export function imageApplyOps(
  input: string,
  output: string,
  ops: ImageOp[],
  quality?: number,
): Promise<void> {
  return invoke("image_apply_ops", { input, output, ops, quality });
}

// ── Video ────────────────────────────────────────────────────────────────────
export function videoTrim(input: string, output: string, start: number, end: number): Promise<void> {
  return invoke("video_trim", { input, output, start, end });
}

export function videoExtractFrame(input: string, output: string, timestamp: number): Promise<void> {
  return invoke("video_extract_frame", { input, output, timestamp });
}

export function videoExtractAudio(input: string, output: string): Promise<void> {
  return invoke("video_extract_audio", { input, output });
}

export function videoConvert(jobId: string, input: string, output: string, crf: number): Promise<void> {
  return invoke("video_convert", { jobId, input, output, crf });
}

export function videoConvertCancel(jobId: string): Promise<void> {
  return invoke("video_convert_cancel", { jobId });
}
