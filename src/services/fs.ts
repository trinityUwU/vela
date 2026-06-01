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

export function extractArchive(path: string, dest: string): Promise<void> {
  return invoke("extract_archive", { path, dest });
}
