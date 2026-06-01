// Zone centrale en mode navigation : grille des entrées du dossier courant.
import type { DirEntry } from "../types";
import { FileTile } from "./FileTile";

interface Props {
  entries: DirEntry[];
  selected: string | null;
  onSelect: (path: string) => void;
  onOpen: (entry: DirEntry) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
  onContextBg: (e: React.MouseEvent) => void;
  onMove: (src: string, destDir: string) => void;
}

export function FileGrid({ entries, selected, onSelect, onOpen, onContext, onContextBg, onMove }: Props) {
  const handleBg = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextBg(e);
  };

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]" onContextMenu={handleBg}>
        Dossier vide
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-3" onContextMenu={handleBg}>
      <div className="flex flex-wrap gap-1 content-start">
        {entries.map((e) => (
          <FileTile
            key={e.path}
            entry={e}
            selected={selected === e.path}
            onClick={() => onSelect(e.path)}
            onDouble={() => onOpen(e)}
            onContext={(ev) => onContext(ev, e)}
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  );
}
