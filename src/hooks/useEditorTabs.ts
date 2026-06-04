// Onglets multi-fichiers du mode Édition : liste synchronisée sur le fichier actif (fm.opened).
import { useCallback, useEffect, useState } from "react";
import type { DirEntry } from "../types";

export function useEditorTabs(opened: DirEntry | null, setOpened: (e: DirEntry | null) => void) {
  const [tabs, setTabs] = useState<DirEntry[]>([]);

  // Tout fichier ouvert devient un onglet ; s'il existe déjà, son entrée est rafraîchie (taille/mtime)
  // pour que le contenu se recharge après une modification ou un remplacement sur disque.
  useEffect(() => {
    if (!opened) return;
    setTabs((prev) => {
      const i = prev.findIndex((t) => t.path === opened.path);
      if (i < 0) return [...prev, opened];
      if (prev[i] === opened) return prev;
      const next = [...prev];
      next[i] = opened;
      return next;
    });
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
