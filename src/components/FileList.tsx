// Liste verticale compacte (pane gauche du mode Édition). Drag source + drop target dossiers.
import { useState } from "react";
import type { DirEntry } from "../types";
import { FileIcon } from "./FileIcon";

interface Props {
  entries: DirEntry[];
  selected: string | null;
  onSelect: (entry: DirEntry) => void;
  onOpen: (entry: DirEntry) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
  onContextBg: (e: React.MouseEvent) => void;
  onMove: (src: string, destDir: string) => void;
}

export function FileList({ entries, selected, onSelect, onOpen, onContext, onContextBg, onMove }: Props) {
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
          selected={selected === e.path}
          onSelect={onSelect}
          onOpen={onOpen}
          onContext={onContext}
          onMove={onMove}
        />
      ))}
    </div>
  );
}

function FileRow({ entry, selected, onSelect, onOpen, onContext, onMove }: {
  entry: DirEntry;
  selected: boolean;
  onSelect: (e: DirEntry) => void;
  onOpen: (e: DirEntry) => void;
  onContext: (ev: React.MouseEvent, e: DirEntry) => void;
  onMove: (src: string, destDir: string) => void;
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
      onClick={() => onSelect(entry)}
      onDoubleClick={() => onOpen(entry)}
      onContextMenu={(ev) => { ev.stopPropagation(); onContext(ev, entry); }}
      title={entry.name}
      className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
        dragOver
          ? "bg-[var(--color-accent-dim)]/20 ring-1 ring-[var(--color-accent)] ring-inset"
          : selected
            ? "bg-[var(--color-surface-hover)]"
            : "hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      <span className="shrink-0"><FileIcon entry={entry} size={18} /></span>
      <span className="truncate text-sm text-[var(--color-text)]">{entry.name}</span>
    </button>
  );
}
