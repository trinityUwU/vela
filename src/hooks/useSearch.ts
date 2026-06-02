// Recherche live avec debounce sur le dossier courant : par nom (récursif) ou dans le contenu.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentMatch, DirEntry } from "../types";
import { searchContent, searchDir } from "../services/fs";

export type SearchMode = "name" | "content";
export interface RecentSearch { q: string; mode: SearchMode; }

const RECENTS_KEY = "vela-search-recents";
const MAX_RECENTS = 8;

function loadRecents(): RecentSearch[] {
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]"); } catch { return []; }
}

export function useSearch(cwd: string) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SearchMode>("name");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirEntry[]>([]);
  const [contentResults, setContentResults] = useState<ContentMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [recents, setRecents] = useState<RecentSearch[]>(loadRecents);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushRecent = useCallback((q: string, m: SearchMode) => {
    setRecents((prev) => {
      const next = [{ q, mode: m }, ...prev.filter((r) => !(r.q === q && r.mode === m))].slice(0, MAX_RECENTS);
      try { localStorage.setItem(RECENTS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const applyRecent = useCallback((r: RecentSearch) => { setMode(r.mode); setQuery(r.q); }, []);
  const clearRecents = useCallback(() => {
    setRecents([]);
    try { localStorage.removeItem(RECENTS_KEY); } catch { /* ignore */ }
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setContentResults([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setContentResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const q = query.trim();
        if (mode === "name") {
          setResults(await searchDir(cwd, q));
          setContentResults([]);
        } else {
          setContentResults(await searchContent(cwd, q));
          setResults([]);
        }
        pushRecent(q, mode);
      } catch {
        setResults([]);
        setContentResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, cwd, open, mode, pushRecent]);

  return { open, setOpen, mode, setMode, query, setQuery, results, contentResults, searching, close, recents, applyRecent, clearRecents };
}
