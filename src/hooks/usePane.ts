// Volet de navigation secondaire (dual-pane / F03) : cwd, listing, sélection et historique propres.
// Volontairement léger — clipboard, undo, corbeille et conflits restent gérés globalement par useFileManager.
import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import * as fs from "../services/fs";
import type { DirEntry, DirListing } from "../types";

export interface PaneState {
  cwd: string;
  listing: DirListing | null;
  selection: Set<string>;
  selected: string | null;
  navigate: (path: string) => void;
  openEntry: (entry: DirEntry) => void;
  goUp: () => void;
  goBack: () => void;
  goForward: () => void;
  canBack: boolean;
  canForward: boolean;
  refresh: () => void;
  selectOne: (path: string) => void;
  toggleSelect: (path: string) => void;
  rangeSelect: (path: string, ordered: DirEntry[]) => void;
  clearSelection: () => void;
  selectionPaths: () => string[];
}

export function usePane(initialCwd: string, showHidden: boolean): PaneState {
  const [cwd, setCwd] = useState(initialCwd);
  const [listing, setListing] = useState<DirListing | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string | null>(null);
  const anchor = useRef<string | null>(null);
  const history = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const [hist, setHist] = useState({ canBack: false, canForward: false });

  const go = useCallback(
    async (path: string, fromHistory: boolean) => {
      try {
        const data = await fs.listDir(path, showHidden);
        setListing(data);
        setCwd(data.path);
        setSelection(new Set());
        setSelected(null);
        anchor.current = null;
        if (!fromHistory && data.path !== history.current[histIdx.current]) {
          history.current = history.current.slice(0, histIdx.current + 1);
          history.current.push(data.path);
          histIdx.current = history.current.length - 1;
        }
        setHist({ canBack: histIdx.current > 0, canForward: histIdx.current < history.current.length - 1 });
      } catch {
        /* dossier illisible — on garde l'état courant */
      }
    },
    [showHidden],
  );

  const navigate = useCallback((path: string) => go(path, false), [go]);
  const refresh = useCallback(() => go(cwd, true), [go, cwd]);

  // Premier listing + relisting quand showHidden change.
  useEffect(() => { go(cwd, true); /* eslint-disable-next-line */ }, [showHidden]);
  useEffect(() => { go(initialCwd, false); /* eslint-disable-next-line */ }, []);

  // Rafraîchissement sur changement fs (événement global, partagé avec le volet principal).
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const un = listen("fs-changed", () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => refreshRef.current(), 300);
    });
    return () => { if (t) clearTimeout(t); un.then((u) => u()); };
  }, []);

  const goUp = useCallback(() => { if (listing?.parent) navigate(listing.parent); }, [listing, navigate]);
  const goBack = useCallback(() => {
    if (histIdx.current <= 0) return;
    histIdx.current -= 1;
    go(history.current[histIdx.current], true);
  }, [go]);
  const goForward = useCallback(() => {
    if (histIdx.current >= history.current.length - 1) return;
    histIdx.current += 1;
    go(history.current[histIdx.current], true);
  }, [go]);

  const openEntry = useCallback((entry: DirEntry) => { if (entry.is_dir) navigate(entry.path); }, [navigate]);

  const selectOne = useCallback((path: string) => {
    anchor.current = path; setSelected(path); setSelection(new Set([path]));
  }, []);
  const toggleSelect = useCallback((path: string) => {
    anchor.current = path; setSelected(path);
    setSelection((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  }, []);
  const rangeSelect = useCallback((path: string, ordered: DirEntry[]) => {
    const from = anchor.current ?? path;
    const i = ordered.findIndex((e) => e.path === from);
    const j = ordered.findIndex((e) => e.path === path);
    if (i < 0 || j < 0) return selectOne(path);
    const [lo, hi] = i < j ? [i, j] : [j, i];
    setSelected(path);
    setSelection(new Set(ordered.slice(lo, hi + 1).map((e) => e.path)));
  }, [selectOne]);
  const clearSelection = useCallback(() => { setSelection(new Set()); setSelected(null); anchor.current = null; }, []);
  const selectionPaths = useCallback(() => [...selection], [selection]);

  return {
    cwd, listing, selection, selected,
    navigate, openEntry, goUp, goBack, goForward, canBack: hist.canBack, canForward: hist.canForward, refresh,
    selectOne, toggleSelect, rangeSelect, clearSelection, selectionPaths,
  };
}
