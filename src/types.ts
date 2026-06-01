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

export interface Place {
  name: string;
  path: string;
  kind: "home" | "dir" | "mount";
}
