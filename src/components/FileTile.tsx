// Tuile fichier/dossier : icône typée + nom. Drag source, drop target si dossier.
import { useState } from "react";
import type { DirEntry } from "../types";
import { FileIcon } from "./FileIcon";

interface Props {
  entry: DirEntry;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDouble: () => void;
  onContext: (e: React.MouseEvent) => void;
  onMove: (src: string, destDir: string) => void;
}

export function FileTile({ entry, selected, onClick, onDouble, onContext, onMove }: Props) {
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
      onClick={onClick}
      onDoubleClick={onDouble}
      onContextMenu={(e) => { e.stopPropagation(); onContext(e); }}
      title={entry.name}
      className={`flex flex-col items-center gap-1.5 w-24 p-2 rounded-lg transition-colors ${
        dragOver
          ? "ring-2 ring-[var(--color-accent)] bg-[var(--color-accent-dim)]/20"
          : selected
            ? "bg-[var(--color-accent-dim)]/40 ring-1 ring-[var(--color-accent)]"
            : "hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      <FileIcon entry={entry} size={34} />
      <span className="text-xs text-center text-[var(--color-text)] leading-tight break-words line-clamp-2 w-full">
        {entry.name}
      </span>
    </button>
  );
}
