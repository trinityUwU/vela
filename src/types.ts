export type Mode = "files" | "edit";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  extension: string;
}

export interface DirListing {
  path: string;
  parent: string | null;
  entries: DirEntry[];
}

export interface FileChunk {
  content: string;
  next_offset: number;
  total_size: number;
  eof: boolean;
}

export interface FavPin {
  name: string;
  path: string;
}

export interface FavGroup {
  name: string;
  pins: FavPin[];
  collapsed: boolean;
}

export interface Favorites {
  pins: FavPin[];
  groups: FavGroup[];
}

export interface Place {
  name: string;
  path: string;
  kind: "home" | "dir" | "mount";
}

export interface EntryProps {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: number;
  permissions: string;
  permissions_octal: number;
  extension: string;
  item_count: number | null;
  file_count: number | null;
  dir_count: number | null;
}

export interface AppInfo {
  name: string;
  desktop_id: string;
  exec: string;
  source: "desktop" | "binary";
  is_default: boolean;
  supports_mime: boolean;
}

export interface FileApps {
  mime: string;
  apps: AppInfo[];
}

export interface ArchiveEntry {
  name: string;
  size: number;
  is_dir: boolean;
  compressed_size: number;
}

export type ExtractionStatus =
  | "extracting" | "paused" | "done" | "error" | "cancelled" | "password_required";

export interface ExtractionJob {
  id: string;
  archiveName: string;
  dest: string;
  current: number;
  total: number;
  status: ExtractionStatus;
  error?: string;
}

export type TransferStatus = "transferring" | "paused" | "done" | "error" | "cancelled";

export interface TransferJob {
  id: string;
  kind: "copy" | "move";
  name: string;
  current: number;
  total: number;
  status: TransferStatus;
  error?: string;
}

export type ClipboardOp = "copy" | "cut";

export interface Clipboard {
  op: ClipboardOp;
  paths: string[];
}

export interface ContentMatch {
  path: string;
  name: string;
  line: number;
  text: string;
}

export interface LargeFile {
  path: string;
  name: string;
  size: number;
}

export interface DupGroup {
  size: number;
  paths: string[];
}

export interface DiskReport {
  total_size: number;
  file_count: number;
  largest: LargeFile[];
  duplicates: DupGroup[];
}

export type DiffStatus = "only_a" | "only_b" | "modified" | "same";

export interface DiffEntry {
  rel: string;
  status: DiffStatus;
  is_dir: boolean;
  size_a: number | null;
  size_b: number | null;
}

export interface DirCompare {
  only_a: number;
  only_b: number;
  modified: number;
  same: number;
  entries: DiffEntry[];
}

export interface MediaCapabilities {
  ffmpeg: boolean;
  ffprobe: boolean;
  demucs: boolean;
  demucs_path: string | null;
}

export interface MediaProbe {
  duration: number;
  width: number;
  height: number;
  has_video: boolean;
  has_audio: boolean;
  format_name: string;
  video_codec: string | null;
  audio_codec: string | null;
}

export interface StemsStatus {
  installed: boolean;
  path: string | null;
}

export interface StemsProgress {
  job_id: string;
  percent: number;
  status: string;
}

export interface StemsInstallProgress {
  job_id: string;
  line: string;
  status: string;
}

export interface VideoProgress {
  job_id: string;
  percent: number;
  status: string;
}

// Édition image accumulée — `kind` correspond au tag serde (lowercase) côté Rust.
export type ImageOp =
  | { kind: "crop"; x: number; y: number; w: number; h: number }
  | { kind: "rotate"; degrees: number }
  | { kind: "flip"; horizontal: boolean }
  | { kind: "resize"; width: number; height: number; keep_aspect: boolean }
  | { kind: "adjust"; brightness: number; contrast: number; saturation: number };
