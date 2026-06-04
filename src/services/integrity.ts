// Wrappers intégrité : empreintes (hash) et détection du type réel d'un fichier.
import { invoke } from "@tauri-apps/api/core";

export interface Hashes {
  md5: string;
  sha1: string;
  sha256: string;
  blake3: string;
}

export interface FileKind {
  mime: string | null;
  ext: string | null;
}

export function fileHash(path: string): Promise<Hashes> {
  return invoke("file_hash", { path });
}

export function fileKind(path: string): Promise<FileKind> {
  return invoke("file_kind", { path });
}
