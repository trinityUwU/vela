// Recherche live avec debounce sur le dossier courant : par nom (récursif) ou dans le contenu.
import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentMatch, DirEntry } from "../types";
import { searchContent, searchDir } from "../services/fs";

export type SearchMode = "name" | "content";

export function useSearch(cwd: string) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<SearchMode>("name");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirEntry[]>([]);
  const [contentResults, setContentResults] = useState<ContentMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        if (mode === "name") {
          setResults(await searchDir(cwd, query.trim()));
          setContentResults([]);
        } else {
          setContentResults(await searchContent(cwd, query.trim()));
          setResults([]);
        }
      } catch {
        setResults([]);
        setContentResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, cwd, open, mode]);

  return { open, setOpen, mode, setMode, query, setQuery, results, contentResults, searching, close };
}
