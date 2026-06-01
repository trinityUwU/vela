// Tri et filtre des entrées du dossier courant — state persisté en localStorage.
import { useState, useCallback } from "react";
import type { DirEntry } from "../types";

export type SortBy = "name" | "size" | "modified" | "extension";
export type SortDir = "asc" | "desc";
export type FilterKind = "all" | "files" | "dirs";

export interface SortState {
  by: SortBy;
  dir: SortDir;
  filter: FilterKind;
  dirsFirst: boolean;
}

const LS_KEY = "vela-sort";

function load(): SortState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as SortState;
  } catch {}
  return { by: "name", dir: "asc", filter: "all", dirsFirst: true };
}

function save(s: SortState) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch {}
}

export function applySortFilter(entries: DirEntry[], s: SortState): DirEntry[] {
  let result = entries;

  if (s.filter === "files") result = result.filter((e) => !e.is_dir);
  else if (s.filter === "dirs") result = result.filter((e) => e.is_dir);

  return [...result].sort((a, b) => {
    if (s.dirsFirst && a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
    let cmp = 0;
    switch (s.by) {
      case "name":      cmp = a.name.localeCompare(b.name, "fr", { sensitivity: "base" }); break;
      case "size":      cmp = a.size - b.size; break;
      case "modified":  cmp = a.modified - b.modified; break;
      case "extension": cmp = a.extension.localeCompare(b.extension, "fr", { sensitivity: "base" }) || a.name.localeCompare(b.name, "fr", { sensitivity: "base" }); break;
    }
    return s.dir === "asc" ? cmp : -cmp;
  });
}

export function useSort() {
  const [sort, setSort] = useState<SortState>(load);

  const update = useCallback((patch: Partial<SortState>) => {
    setSort((prev) => {
      const next = { ...prev, ...patch };
      save(next);
      return next;
    });
  }, []);

  const toggleBy = useCallback((by: SortBy) => {
    setSort((prev) => {
      const next: SortState = by === prev.by
        ? { ...prev, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { ...prev, by, dir: "asc" };
      save(next);
      return next;
    });
  }, []);

  return { sort, update, toggleBy };
}
