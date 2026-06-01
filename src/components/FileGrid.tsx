// Zone centrale en mode navigation : grille des entrées du dossier courant.
import type { DirEntry } from "../types";
import { FileTile } from "./FileTile";

interface Props {
  entries: DirEntry[];
  selection: Set<string>;
  onSelect: (entry: DirEntry, e: React.MouseEvent) => void;
  onOpen: (entry: DirEntry) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
  onContextBg: (e: React.MouseEvent) => void;
  onClearBg: () => void;
  onMove: (src: string, destDir: string) => void;
  colorOf: (path: string) => string | undefined;
}

export function FileGrid({ entries, selection, onSelect, onOpen, onContext, onContextBg, onClearBg, onMove, colorOf }: Props) {
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
    <div
      className="flex-1 overflow-y-auto p-3"
      onContextMenu={handleBg}
      onClick={(e) => { if (e.target === e.currentTarget) onClearBg(); }}
    >
      <div
        className="flex flex-wrap gap-1 content-start"
        onClick={(e) => { if (e.target === e.currentTarget) onClearBg(); }}
      >
        {entries.map((e) => (
          <FileTile
            key={e.path}
            entry={e}
            selected={selection.has(e.path)}
            color={colorOf(e.path)}
            onClick={(ev) => onSelect(e, ev)}
            onDouble={() => onOpen(e)}
            onContext={(ev) => onContext(ev, e)}
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  );
}
