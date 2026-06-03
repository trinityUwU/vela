// Navigation clavier dans la grille/liste (flèches + Entrée). Capture phase + e.code (robuste WebKitGTK).
import { useCallback, useEffect, useRef } from "react";
import type { DirEntry } from "../types";

interface Args {
  entries: DirEntry[];
  view: "grid" | "list";
  editorActive: boolean;
  selected: string | null;
  selectOne: (path: string) => void;
  openEntry: (e: DirEntry) => void;
  searchOpen: boolean;
}

export function useGridNav({ entries, view, editorActive, selected, selectOne, openEntry, searchOpen }: Args) {
  const gridCols = useRef(1);

  const moveSel = useCallback((delta: number) => {
    if (!entries.length) return;
    const i = entries.findIndex((e) => e.path === selected);
    const next = i < 0 ? (delta > 0 ? 0 : entries.length - 1) : Math.max(0, Math.min(entries.length - 1, i + delta));
    selectOne(entries[next].path);
  }, [entries, selected, selectOne]);

  const navSel = useCallback((delta: number, axis: "x" | "y") => {
    const grid = view === "grid" && !editorActive;
    if (!grid) { if (axis === "x") return; moveSel(delta); return; }
    moveSel(axis === "y" ? delta * gridCols.current : delta);
  }, [view, editorActive, moveSel]);

  const activateSel = useCallback(() => {
    const e = entries.find((x) => x.path === selected);
    if (e) openEntry(e);
  }, [entries, selected, openEntry]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (searchOpen || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest(".cm-editor"))) return;
      const k = e.code || e.key;
      if (k === "Enter" || k === "NumpadEnter") { e.preventDefault(); activateSel(); return; }
      if (k === "ArrowUp" || k === "Up") { e.preventDefault(); navSel(-1, "y"); return; }
      if (k === "ArrowDown" || k === "Down") { e.preventDefault(); navSel(1, "y"); return; }
      if (k === "ArrowLeft" || k === "Left") { e.preventDefault(); navSel(-1, "x"); return; }
      if (k === "ArrowRight" || k === "Right") { e.preventDefault(); navSel(1, "x"); return; }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [searchOpen, navSel, activateSel]);

  return gridCols;
}
