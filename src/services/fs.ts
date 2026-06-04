// Wrappers typés autour des commandes Tauri (backend Rust).
import { invoke } from "@tauri-apps/api/core";
import type { DirListing, Favorites, FileChunk, Place } from "../types";

export function openNative(path: string): Promise<void> {
  return invoke("open_native", { path });
}

export function moveEntry(src: string, destDir: string): Promise<void> {
  return invoke("move_entry", { src, destDir });
}

export function getEntryProps(path: string): Promise<import("../types").EntryProps> {
  return invoke("get_entry_props", { path });
}

export function analyzeDisk(path: string): Promise<import("../types").DiskReport> {
  return invoke("analyze_disk", { path });
}

export function compareDirs(a: string, b: string): Promise<import("../types").DirCompare> {
  return invoke("compare_dirs", { a, b });
}

// Espace disque du volume contenant `path` : [octets libres, octets totaux].
export function diskFree(path: string): Promise<[number, number]> {
  return invoke("disk_free", { path });
}

// ── Lecteur vidéo natif (GStreamer → frames JPEG via Channel) ────────────────
export interface MediaInfo { duration: number; width: number; height: number; }

export function playerOpen(id: string, path: string, onFrame: import("@tauri-apps/api/core").Channel<ArrayBuffer>): Promise<MediaInfo> {
  return invoke("player_open", { id, path, onFrame });
}
export function playerOpenAudio(id: string, path: string, onSpectrum: import("@tauri-apps/api/core").Channel<ArrayBuffer>): Promise<MediaInfo> {
  return invoke("player_open_audio", { id, path, onSpectrum });
}
export function playerPosition(id: string): Promise<number> { return invoke("player_position", { id }); }
export function playerPause(id: string): Promise<void> { return invoke("player_pause", { id }); }
export function playerResume(id: string): Promise<void> { return invoke("player_resume", { id }); }
export function playerSeek(id: string, secs: number): Promise<void> { return invoke("player_seek", { id, secs }); }
export function playerSetVolume(id: string, volume: number): Promise<void> { return invoke("player_set_volume", { id, volume }); }
export function playerClose(id: string): Promise<void> { return invoke("player_close", { id }); }

export function getAppsForFile(path: string): Promise<import("../types").FileApps> {
  return invoke("get_apps_for_file", { path });
}

export function setDefaultApp(desktopId: string, mime: string): Promise<void> {
  return invoke("set_default_app", { desktopId, mime });
}

export function searchPathBins(query: string): Promise<import("../types").AppInfo[]> {
  return invoke("search_path_bins", { query });
}

export function setCustomCommand(name: string, exec: string, mime: string): Promise<string> {
  return invoke("set_custom_command", { name, exec, mime });
}

export function listDir(path: string, showHidden = false): Promise<DirListing> {
  return invoke<DirListing>("list_dir", { path, showHidden });
}

export function readFile(path: string): Promise<string> {
  return invoke<string>("read_file", { path });
}

export function readFileChunk(path: string, offset: number, maxBytes: number): Promise<FileChunk> {
  return invoke<FileChunk>("read_file_chunk", { path, offset, maxBytes });
}

export function writeFile(path: string, content: string): Promise<void> {
  return invoke("write_file", { path, content });
}

export function renameEntry(path: string, newName: string): Promise<string> {
  return invoke<string>("rename_entry", { path, newName });
}

export function deleteEntry(path: string): Promise<void> {
  return invoke("delete_entry", { path });
}

export function createDir(path: string, name: string): Promise<string> {
  return invoke<string>("create_dir", { path, name });
}

export function readFileBase64(path: string): Promise<string> {
  return invoke<string>("read_file_base64", { path });
}

export function writeFileBase64(path: string, dataB64: string): Promise<void> {
  return invoke("write_file_base64", { path, dataB64 });
}

export interface ByteRange {
  dataB64: string;
  total: number;
}

export function readByteRange(path: string, offset: number, len: number): Promise<ByteRange> {
  return invoke<ByteRange>("read_byte_range", { path, offset, len });
}

export function searchDir(root: string, query: string): Promise<import("../types").DirEntry[]> {
  return invoke("search_dir", { root, query });
}

export function loadFavorites(): Promise<Favorites> {
  return invoke<Favorites>("load_favorites");
}

export function saveFavorites(favorites: Favorites): Promise<void> {
  return invoke("save_favorites", { favorites });
}

export function homeDir(): Promise<string> {
  return invoke<string>("home_dir");
}

export function listPlaces(): Promise<Place[]> {
  return invoke<Place[]>("list_places");
}

export function listArchive(path: string): Promise<import("../types").ArchiveEntry[]> {
  return invoke("list_archive", { path });
}

// conflict : "replace" (écrase dans dest) | "keep" (dossier « dest (n) ») | undefined (pas de conflit).
export function startExtraction(path: string, dest: string, conflict?: "replace" | "keep"): Promise<string> {
  return invoke("start_extraction", { path, dest, conflict: conflict ?? null });
}

export function pathExists(path: string): Promise<boolean> {
  return invoke("path_exists", { path });
}

export function extractionPause(jobId: string): Promise<void> {
  return invoke("extraction_pause", { jobId });
}

export function extractionResume(jobId: string): Promise<void> {
  return invoke("extraction_resume", { jobId });
}

export function extractionCancel(jobId: string): Promise<void> {
  return invoke("extraction_cancel", { jobId });
}

export function extractionProvidePassword(jobId: string, password: string): Promise<void> {
  return invoke("extraction_provide_password", { jobId, password });
}

export function trashEntries(paths: string[]): Promise<void> {
  return invoke("trash_entries", { paths });
}

export function deleteEntries(paths: string[]): Promise<void> {
  return invoke("delete_entries", { paths });
}

// Résolution d'un conflit de nom : remplacer / ignorer / garder les deux / fusionner (dossiers).
export type ConflictResolution = "replace" | "skip" | "keep" | "merge";

export interface Conflict {
  name: string;
  srcPath: string;
  destPath: string;
  srcSize: number;
  destSize: number;
  srcIsDir: boolean;
  destIsDir: boolean;
}

export function scanConflicts(paths: string[], destDir: string): Promise<Conflict[]> {
  return invoke<Conflict[]>("scan_conflicts", { paths, destDir });
}

export function copyEntries(
  paths: string[], destDir: string, resolutions: Record<string, ConflictResolution> = {},
): Promise<string[]> {
  return invoke<string[]>("copy_entries", { paths, destDir, resolutions });
}

export function moveEntries(
  paths: string[], destDir: string, resolutions: Record<string, ConflictResolution> = {},
): Promise<void> {
  return invoke("move_entries", { paths, destDir, resolutions });
}

export type ArchiveFormat = "zip" | "targz" | "7z" | "rar";

export function startCompression(
  paths: string[], dest: string, format: ArchiveFormat, password?: string,
): Promise<string> {
  return invoke<string>("start_compression", { paths, dest, format, password: password || null });
}

export function searchContent(root: string, query: string): Promise<import("../types").ContentMatch[]> {
  return invoke("search_content", { root, query });
}

export function watchDir(path: string): Promise<void> {
  return invoke("watch_dir", { path });
}

export function trashDir(): Promise<string> {
  return invoke<string>("trash_dir");
}

export function trashCount(): Promise<number> {
  return invoke<number>("trash_count");
}

export function emptyTrash(): Promise<void> {
  return invoke("empty_trash");
}

export function restoreTrash(paths: string[]): Promise<void> {
  return invoke("restore_trash", { paths });
}

export function thumbnail(path: string, max = 128): Promise<string> {
  return invoke<string>("thumbnail", { path, max });
}

export function transferPause(jobId: string): Promise<void> {
  return invoke("transfer_pause", { jobId });
}

export function transferResume(jobId: string): Promise<void> {
  return invoke("transfer_resume", { jobId });
}

export function transferCancel(jobId: string): Promise<void> {
  return invoke("transfer_cancel", { jobId });
}
