// Gestion des onglets terminal : ouverture/fermeture de sessions PTY, onglet actif.
import { useCallback, useState } from "react";
import { termOpen, termClose } from "../services/term";

export interface TermTab {
  id: string;
  title: string;
  cwd: string;
  color?: string;
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || "/";
}

export function useTerminals() {
  const [tabs, setTabs] = useState<TermTab[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const open = useCallback(async (cwd: string, shell?: string) => {
    try {
      const id = await termOpen(cwd, 80, 24, shell);
      setTabs((t) => [...t, { id, title: basename(cwd), cwd }]);
      setActiveId(id);
      return id;
    } catch {
      return null;
    }
  }, []);

  const drop = useCallback((id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      setActiveId((cur) => (cur === id ? next[next.length - 1]?.id ?? null : cur));
      return next;
    });
  }, []);

  const close = useCallback((id: string) => {
    termClose(id).catch(() => {});
    drop(id);
  }, [drop]);

  const rename = useCallback((id: string, title: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, title: title || t.title } : t)));
  }, []);

  const setColor = useCallback((id: string, color: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, color: color || undefined } : t)));
  }, []);

  return { tabs, activeId, setActiveId, open, close, exit: drop, rename, setColor };
}
