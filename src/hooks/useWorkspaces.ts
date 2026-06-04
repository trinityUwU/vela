// Espaces de travail (F24) : un nom → un profil + un ensemble d'onglets, rouvrable d'un coup.
// Persistance localStorage (souverain, pas de fichier de config externe pour cet état purement front).
import { useCallback, useEffect, useState } from "react";
import type { TabSeed } from "./useFolderTabs";

const KEY = "vela-workspaces";

export interface Workspace {
  id: string;
  name: string;
  profileId: string;
  tabs: TabSeed[];
}

function load(): Workspace[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export interface UseWorkspaces {
  workspaces: Workspace[];
  save: (name: string, profileId: string, tabs: TabSeed[]) => void;
  remove: (id: string) => void;
}

export function useWorkspaces(): UseWorkspaces {
  const [workspaces, setWorkspaces] = useState<Workspace[]>(load);

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(workspaces)); } catch { /* quota */ }
  }, [workspaces]);

  const save = useCallback((name: string, profileId: string, tabs: TabSeed[]) => {
    const clean = name.trim();
    if (!clean) return;
    setWorkspaces((prev) => {
      const id = prev.find((w) => w.name === clean)?.id ?? crypto.randomUUID();
      const entry: Workspace = { id, name: clean, profileId, tabs };
      const without = prev.filter((w) => w.id !== id);
      return [...without, entry];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setWorkspaces((prev) => prev.filter((w) => w.id !== id));
  }, []);

  return { workspaces, save, remove };
}
