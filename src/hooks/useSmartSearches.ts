// Dossiers intelligents (F05) : recherches avancées nommées, rejouées en live. Persistance localStorage.
import { useCallback, useEffect, useState } from "react";
import type { SearchCriteria } from "../services/advsearch";

const KEY = "vela-smart-searches";

export interface SmartSearch {
  id: string;
  name: string;
  criteria: SearchCriteria;
}

function load(): SmartSearch[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export interface UseSmartSearches {
  searches: SmartSearch[];
  save: (name: string, criteria: SearchCriteria) => void;
  remove: (id: string) => void;
}

export function useSmartSearches(): UseSmartSearches {
  const [searches, setSearches] = useState<SmartSearch[]>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(searches)); } catch { /* quota */ }
  }, [searches]);

  const save = useCallback((name: string, criteria: SearchCriteria) => {
    const clean = name.trim();
    if (!clean) return;
    setSearches((prev) => {
      const id = prev.find((s) => s.name === clean)?.id ?? crypto.randomUUID();
      return [...prev.filter((s) => s.id !== id), { id, name: clean, criteria }];
    });
  }, []);

  const remove = useCallback((id: string) => setSearches((prev) => prev.filter((s) => s.id !== id)), []);

  return { searches, save, remove };
}
