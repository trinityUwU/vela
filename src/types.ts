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
