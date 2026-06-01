// Liste verticale compacte (pane gauche du mode Édition). Drag source + drop target dossiers.
import { useState } from "react";
import type { DirEntry } from "../types";
import { FileIcon } from "./FileIcon";

interface Props {
  entries: DirEntry[];
  selection: Set<string>;
  active: string | null;
  onSelect: (entry: DirEntry, e: React.MouseEvent) => void;
  onOpen: (entry: DirEntry) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
  onContextBg: (e: React.MouseEvent) => void;
  onMove: (src: string, destDir: string) => void;
  colorOf: (path: string) => string | undefined;
}

export function FileList({ entries, selection, active, onSelect, onOpen, onContext, onContextBg, onMove, colorOf }: Props) {
  const handleBg = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextBg(e);
  };
  return (
    <div className="w-64 shrink-0 border-r border-[var(--color-border)] overflow-y-auto py-1" onContextMenu={handleBg}>
      {entries.map((e) => (
        <FileRow
          key={e.path}
          entry={e}
          selected={selection.has(e.path)}
          active={active === e.path}
          onSelect={onSelect}
          onOpen={onOpen}
          onContext={onContext}
          onMove={onMove}
          color={colorOf(e.path)}
        />
      ))}
    </div>
  );
}

function FileRow({ entry, selected, active, onSelect, onOpen, onContext, onMove, color }: {
  entry: DirEntry;
  selected: boolean;
  active: boolean;
  onSelect: (e: DirEntry, ev: React.MouseEvent) => void;
  onOpen: (e: DirEntry) => void;
  onContext: (ev: React.MouseEvent, e: DirEntry) => void;
  onMove: (src: string, destDir: string) => void;
  color?: string;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/vela", entry.path);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!entry.is_dir) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!entry.is_dir) return;
    e.preventDefault();
    setDragOver(false);
    const src = e.dataTransfer.getData("application/vela");
    if (!src || src === entry.path) return;
    onMove(src, entry.path);
  };

  return (
    <button
      draggable
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={(ev) => onSelect(entry, ev)}
      onDoubleClick={() => onOpen(entry)}
      onContextMenu={(ev) => { ev.stopPropagation(); onContext(ev, entry); }}
      title={entry.name}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
        dragOver
          ? "bg-[var(--color-accent-dim)]/20 ring-1 ring-[var(--color-accent)] ring-inset"
          : selected
            ? "bg-[var(--color-accent-dim)]/40"
            : "hover:bg-[var(--color-surface-hover)]"
      } ${active ? "ring-1 ring-[var(--color-accent)] ring-inset" : ""}`}
    >
      <span className="shrink-0"><FileIcon entry={entry} size={18} /></span>
      <span className="truncate text-sm text-[var(--color-text)] flex-1">{entry.name}</span>
      {color && <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
    </button>
  );
}
