// Panneau arborescence : dossiers pliables, chargement lazy par expand, mise en évidence du cwd.
import { useCallback, useState } from "react";
import { listDir } from "../services/fs";
import { Folder } from "./icons";

interface FileTreeProps {
  rootPath: string;
  cwd: string;
  onNavigate: (path: string) => void;
  showHidden: boolean;
  onError: (e: string) => void;
}

function baseName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

async function loadDirs(path: string, showHidden: boolean): Promise<string[]> {
  try {
    const listing = await listDir(path, showHidden);
    return listing.entries.filter((e) => e.is_dir).map((e) => e.path);
  } catch (e) {
    console.error("FileTree.loadDirs", e);
    throw e;
  }
}

function Chevron({ open }: { open: boolean }): React.ReactElement {
  return (
    <span className="shrink-0 w-3 text-center text-[10px] text-[var(--color-text-dim)]">
      {open ? "▼" : "▶"}
    </span>
  );
}

interface NodeProps {
  path: string;
  depth: number;
  cwd: string;
  onNavigate: (path: string) => void;
  showHidden: boolean;
  onError: (e: string) => void;
}

function NodeRow({ path, depth, active, open, onToggle, onNavigate }: {
  path: string; depth: number; active: boolean; open: boolean;
  onToggle: () => void; onNavigate: (path: string) => void;
}): React.ReactElement {
  const cls = active
    ? "text-[var(--color-accent)]"
    : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]";
  return (
    <div
      className={`group flex items-center gap-1 py-1 pr-2 text-sm cursor-pointer transition-colors ${cls}`}
      style={{ paddingLeft: `${depth * 12 + 6}px` }}
    >
      <button onClick={onToggle} className="shrink-0"><Chevron open={open} /></button>
      <span className="shrink-0 opacity-70"><Folder /></span>
      <button className="flex-1 text-left truncate text-inherit" onClick={() => onNavigate(path)} title={path}>
        {baseName(path) || "/"}
      </button>
    </div>
  );
}

function TreeNode({ path, depth, cwd, onNavigate, showHidden, onError }: NodeProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<string[] | null>(null);

  const toggle = useCallback(async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (children !== null) return;
    try {
      setChildren(await loadDirs(path, showHidden));
    } catch (e) {
      setChildren([]);
      onError(String(e));
    }
  }, [open, children, path, showHidden, onError]);

  return (
    <div>
      <NodeRow path={path} depth={depth} active={cwd === path} open={open}
        onToggle={toggle} onNavigate={onNavigate} />
      {open && children !== null && children.map((c) => (
        <TreeNode key={c} path={c} depth={depth + 1} cwd={cwd}
          onNavigate={onNavigate} showHidden={showHidden} onError={onError} />
      ))}
    </div>
  );
}

export function FileTree({ rootPath, cwd, onNavigate, showHidden, onError }: FileTreeProps): React.ReactElement {
  return (
    <div className="w-full h-full overflow-y-auto bg-[var(--color-surface)] border-r border-[var(--color-border)]">
      <TreeNode path={rootPath} depth={0} cwd={cwd}
        onNavigate={onNavigate} showHidden={showHidden} onError={onError} />
    </div>
  );
}
