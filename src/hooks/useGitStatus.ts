// Statut git du dossier courant : map path→statut + branche, rafraîchi sur fs-changed (debounce).
import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { gitRepoRoot, gitStatus, gitCurrentBranch } from "../services/git";

export interface GitState {
  statusMap: Map<string, string>;
  branch: string | null;
  repoRoot: string | null;
  refresh: () => void;
}

export function useGitStatus(cwd: string): GitState {
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [branch, setBranch] = useState<string | null>(null);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    gitRepoRoot(cwd)
      .then((root) => {
        setRepoRoot(root);
        if (!root) {
          setStatusMap(new Map());
          setBranch(null);
          return;
        }
        gitStatus(cwd).then((list) => setStatusMap(new Map(list.map((s) => [s.path, s.status])))).catch(() => {});
        gitCurrentBranch(cwd).then(setBranch).catch(() => setBranch(null));
      })
      .catch(() => setRepoRoot(null));
  }, [cwd]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const un = listen("fs-changed", () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(refresh, 300);
    });
    return () => { un.then((f) => f()); };
  }, [refresh]);

  return { statusMap, branch, repoRoot, refresh };
}
