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

export function startExtraction(path: string, dest: string): Promise<string> {
  return invoke("start_extraction", { path, dest });
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

export function copyEntries(paths: string[], destDir: string): Promise<string[]> {
  return invoke<string[]>("copy_entries", { paths, destDir });
}

export function moveEntries(paths: string[], destDir: string): Promise<void> {
  return invoke("move_entries", { paths, destDir });
}

export function createArchive(paths: string[], dest: string, format: "zip" | "targz"): Promise<string> {
  return invoke<string>("create_archive", { paths, dest, format });
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
