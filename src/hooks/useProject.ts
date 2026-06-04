// Détection de projet (F08) : mémoïse les tâches détectées par dossier. Aucune exécution automatique.
import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export interface ProjectTask {
  label: string;
  command: string;
}

export interface ProjectInfo {
  kind: string;
  tasks: ProjectTask[];
}

const cache = new Map<string, ProjectInfo>();

export function useProject(cwd: string): ProjectInfo {
  const [info, setInfo] = useState<ProjectInfo>({ kind: "", tasks: [] });

  useEffect(() => {
    if (!cwd) return;
    const cached = cache.get(cwd);
    if (cached) { setInfo(cached); return; }
    let alive = true;
    invoke<ProjectInfo>("project_detect", { path: cwd })
      .then((r) => { cache.set(cwd, r); if (alive) setInfo(r); })
      .catch(() => { if (alive) setInfo({ kind: "", tasks: [] }); });
    return () => { alive = false; };
  }, [cwd]);

  return info;
}
