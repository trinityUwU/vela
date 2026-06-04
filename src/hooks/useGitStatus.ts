// Statut git du dossier courant : map path→statut + branche, rafraîchi sur fs-changed (debounce).
import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { gitRepoRoot, gitStatus, gitCurrentBranch, gitAheadBehind } from "../services/git";
import type { GitFileStatus } from "../services/git";

export interface GitState {
  statusMap: Map<string, string>;
  files: GitFileStatus[];
  aheadBehind: [number, number];
  branch: string | null;
  repoRoot: string | null;
  refresh: () => void;
}

export function useGitStatus(cwd: string): GitState {
  const [statusMap, setStatusMap] = useState<Map<string, string>>(new Map());
  const [files, setFiles] = useState<GitFileStatus[]>([]);
  const [aheadBehind, setAheadBehind] = useState<[number, number]>([0, 0]);
  const [branch, setBranch] = useState<string | null>(null);
  const [repoRoot, setRepoRoot] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    gitRepoRoot(cwd)
      .then((root) => {
        setRepoRoot(root);
        if (!root) {
          setStatusMap(new Map());
          setFiles([]);
          setAheadBehind([0, 0]);
          setBranch(null);
          return;
        }
        gitStatus(cwd).then((list) => {
          setStatusMap(new Map(list.map((s) => [s.path, s.status])));
          setFiles(list);
        }).catch(() => {});
        gitCurrentBranch(cwd).then(setBranch).catch(() => setBranch(null));
        gitAheadBehind(cwd).then(setAheadBehind).catch(() => setAheadBehind([0, 0]));
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

  return { statusMap, files, aheadBehind, branch, repoRoot, refresh };
}
