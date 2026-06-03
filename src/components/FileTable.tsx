// Vue liste détaillée du mode Fichiers : colonnes Nom/Taille/Date/Type, tri au clic d'en-tête.
import { useEffect, useRef, useState } from "react";
import type { DirEntry } from "../types";
import type { SortBy, SortState } from "../hooks/useSort";
import { FileIcon } from "./FileIcon";
import { fmtSize, fmtDate } from "../services/format";

interface Props {
  entries: DirEntry[];
  selection: Set<string>;
  active: string | null;
  sort: SortState;
  onToggleBy: (by: SortBy) => void;
  onSelect: (entry: DirEntry, e: React.MouseEvent) => void;
  onOpen: (entry: DirEntry) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
  onContextBg: (e: React.MouseEvent) => void;
  onClearBg: () => void;
  onMove: (src: string, destDir: string) => void;
  folderSizes: Record<string, number>;
  colorOf: (path: string) => string | undefined;
  gitOf?: (path: string) => string | undefined;
}

const GIT_COLOR: Record<string, string> = {
  modified: "#e2b340",
  new: "#4caf50",
  deleted: "#e0524f",
  renamed: "#5b9bd5",
  ignored: "#6b7280",
};

const COLS: { by: SortBy; label: string; className: string }[] = [
  { by: "name", label: "Nom", className: "flex-1 min-w-0" },
  { by: "size", label: "Taille", className: "w-24 text-right" },
  { by: "modified", label: "Modifié", className: "w-36" },
  { by: "extension", label: "Type", className: "w-20" },
];

export function FileTable(props: Props) {
  const { entries, selection, active, sort, onToggleBy, onSelect, onOpen, onContext, onContextBg, onClearBg, onMove, folderSizes, colorOf, gitOf } = props;
  const handleBg = (e: React.MouseEvent) => { e.preventDefault(); onContextBg(e); };
  const arrow = (by: SortBy) => (sort.by === by ? (sort.dir === "asc" ? " ▲" : " ▼") : "");

  return (
    <div className="flex-1 flex flex-col min-h-0" onContextMenu={handleBg}>
      <div className="flex items-center gap-3 px-3 h-7 shrink-0 border-b border-[var(--color-border)] text-[11px] uppercase tracking-wide text-[var(--color-text-dim)]">
        {COLS.map((c) => (
          <button key={c.by} onClick={() => onToggleBy(c.by)} className={`${c.className} text-left hover:text-[var(--color-text)] truncate`}>
            {c.label}{arrow(c.by)}
          </button>
        ))}
      </div>
      <div
        className="flex-1 overflow-y-auto"
        onClick={(e) => { if (e.target === e.currentTarget) onClearBg(); }}
      >
        {entries.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-dim)]">Dossier vide</div>
        ) : (
          entries.map((e) => (
            <Row
              key={e.path}
              entry={e}
              selected={selection.has(e.path)}
              active={active === e.path}
              dirSize={folderSizes[e.path]}
              color={colorOf(e.path)}
              git={gitOf?.(e.path)}
              onSelect={onSelect}
              onOpen={onOpen}
              onContext={onContext}
              onMove={onMove}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Row({ entry, selected, active, dirSize, color, git, onSelect, onOpen, onContext, onMove }: {
  entry: DirEntry;
  selected: boolean;
  active: boolean;
  dirSize?: number;
  color?: string;
  git?: string;
  onSelect: (e: DirEntry, ev: React.MouseEvent) => void;
  onOpen: (e: DirEntry) => void;
  onContext: (ev: React.MouseEvent, e: DirEntry) => void;
  onMove: (src: string, destDir: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (active && btnRef.current) btnRef.current.scrollIntoView({ block: "nearest" });
  }, [active]);
  const handleDrop = (e: React.DragEvent) => {
    if (!entry.is_dir) return;
    e.preventDefault();
    setDragOver(false);
    const src = e.dataTransfer.getData("application/vela");
    if (src && src !== entry.path) onMove(src, entry.path);
  };

  return (
    <button
      ref={btnRef}
      tabIndex={-1}
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("application/vela", entry.path); e.dataTransfer.effectAllowed = "move"; }}
      onDragOver={(e) => { if (entry.is_dir) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); } }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={(ev) => onSelect(entry, ev)}
      onDoubleClick={() => onOpen(entry)}
      onContextMenu={(ev) => { ev.stopPropagation(); onContext(ev, entry); }}
      title={entry.name}
      className={`w-full flex items-center gap-3 px-3 py-1 text-left transition-colors ${
        dragOver
          ? "bg-[var(--color-accent-dim)]/20 ring-1 ring-[var(--color-accent)] ring-inset"
          : selected ? "bg-[var(--color-accent-dim)]/40" : "hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      <span className="flex-1 min-w-0 flex items-center gap-2">
        <span className="shrink-0"><FileIcon entry={entry} size={18} /></span>
        <span className="truncate text-sm text-[var(--color-text)]">{entry.name}</span>
        {color && <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
        {git && <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: GIT_COLOR[git] ?? "#888" }} title={`git: ${git}`} />}
      </span>
      <span className="w-24 text-right text-xs text-[var(--color-text-dim)] tabular-nums">{entry.is_dir ? (dirSize !== undefined ? fmtSize(dirSize) : "—") : fmtSize(entry.size)}</span>
      <span className="w-36 text-xs text-[var(--color-text-dim)] tabular-nums">{fmtDate(entry.modified)}</span>
      <span className="w-20 text-xs text-[var(--color-text-dim)] truncate">{entry.is_dir ? "dossier" : entry.extension || "—"}</span>
    </button>
  );
}
