// Une tuile fichier/dossier : icône typée + nom.
import type { DirEntry } from "../types";
import { FileIcon } from "./FileIcon";

interface Props {
  entry: DirEntry;
  selected: boolean;
  onClick: () => void;
  onDouble: () => void;
  onContext: (e: React.MouseEvent) => void;
}

export function FileTile({ entry, selected, onClick, onDouble, onContext }: Props) {
  return (
    <button
      onClick={onClick}
      onDoubleClick={onDouble}
      onContextMenu={onContext}
      title={entry.name}
      className={`flex flex-col items-center gap-1.5 w-24 p-2 rounded-lg transition-colors ${
        selected
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
