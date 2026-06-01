// Recherche live avec debounce 300ms sur le dossier courant (récursif, 200 résultats max).
import { useCallback, useEffect, useRef, useState } from "react";
import type { DirEntry } from "../types";
import { searchDir } from "../services/fs";

export function useSearch(cwd: string) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DirEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
  }, []);

  useEffect(() => {
    if (!open) return;
    close();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cwd]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await searchDir(cwd, query.trim());
        setResults(res);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, cwd, open]);

  return { open, setOpen, query, setQuery, results, searching, close };
}
