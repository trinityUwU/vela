// Tuile fichier/dossier : icône typée + nom. Drag source, drop target si dossier.
import { useEffect, useRef, useState } from "react";
import type { DirEntry } from "../types";
import { FileIcon } from "./FileIcon";
import { previewKind } from "../services/file-kind";
import { useThumbnail } from "../hooks/useThumbnail";

interface Props {
  entry: DirEntry;
  selected: boolean;
  active: boolean;
  color?: string;
  onClick: (e: React.MouseEvent) => void;
  onDouble: () => void;
  onContext: (e: React.MouseEvent) => void;
  onMove: (src: string, destDir: string) => void;
}

export function FileTile({ entry, selected, active, color, onClick, onDouble, onContext, onMove }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const isImage = !entry.is_dir && previewKind(entry.extension) === "image";
  const thumb = useThumbnail(entry.path, isImage);

  useEffect(() => {
    if (active && btnRef.current) btnRef.current.scrollIntoView({ block: "nearest" });
  }, [active]);

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
      ref={(el) => { btnRef.current = el; thumb.ref.current = el; }}
      tabIndex={-1}
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
      <span className="relative">
        {isImage && thumb.src && !thumb.error ? (
          <img
            src={thumb.src}
            alt={entry.name}
            draggable={false}
            className="w-[34px] h-[34px] object-cover rounded"
          />
        ) : (
          <FileIcon entry={entry} size={34} />
        )}
        {color && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ring-2 ring-[var(--color-bg)]"
            style={{ backgroundColor: color }}
          />
        )}
      </span>
      <span className="text-xs text-center text-[var(--color-text)] leading-tight break-words line-clamp-2 w-full">
        {entry.name}
      </span>
    </button>
  );
}
