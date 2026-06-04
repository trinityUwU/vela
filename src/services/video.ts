// Wrappers typés de la boîte à outils vidéo (F18).
import { invoke } from "@tauri-apps/api/core";

export function videoToGif(input: string, output: string, start: number, dur: number, fps: number, width: number): Promise<void> {
  return invoke("video_to_gif", { input, output, start, dur, fps, width });
}

export function videoSubtitles(input: string, srt: string, output: string): Promise<void> {
  return invoke("video_subtitles", { input, srt, output });
}

export function videoTargetSize(input: string, output: string, targetMb: number): Promise<void> {
  return invoke("video_target_size", { input, output, targetMb });
}

export function videoStoryboard(input: string, n: number): Promise<string[]> {
  return invoke<string[]>("video_storyboard", { input, n });
}
