// Onglets multi-fichiers du mode Édition : liste synchronisée sur le fichier actif (fm.opened).
import { useCallback, useEffect, useState } from "react";
import type { DirEntry } from "../types";

export function useEditorTabs(opened: DirEntry | null, setOpened: (e: DirEntry | null) => void) {
  const [tabs, setTabs] = useState<DirEntry[]>([]);

  // Tout fichier ouvert devient (ou réactive) un onglet.
  useEffect(() => {
    if (!opened) return;
    setTabs((prev) => (prev.some((t) => t.path === opened.path) ? prev : [...prev, opened]));
  }, [opened]);

  const select = useCallback((path: string) => {
    setTabs((prev) => {
      const t = prev.find((x) => x.path === path);
      if (t) setOpened(t);
      return prev;
    });
  }, [setOpened]);

  const close = useCallback((path: string) => {
    setTabs((prev) => {
      const idx = prev.findIndex((t) => t.path === path);
      if (idx < 0) return prev;
      const next = prev.filter((t) => t.path !== path);
      if (opened?.path === path) setOpened(next[idx] ?? next[idx - 1] ?? null);
      return next;
    });
  }, [opened, setOpened]);

  return { tabs, activePath: opened?.path ?? null, select, close };
}
