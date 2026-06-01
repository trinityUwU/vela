// Zone centrale en mode navigation : grille des entrées du dossier courant.
import type { DirEntry } from "../types";
import { FileTile } from "./FileTile";

interface Props {
  entries: DirEntry[];
  selected: string | null;
  onSelect: (path: string) => void;
  onOpen: (entry: DirEntry) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
}

export function FileGrid({ entries, selected, onSelect, onOpen, onContext }: Props) {
  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]">
        Dossier vide
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="flex flex-wrap gap-1 content-start">
        {entries.map((e) => (
          <FileTile
            key={e.path}
            entry={e}
            selected={selected === e.path}
            onClick={() => onSelect(e.path)}
            onDouble={() => onOpen(e)}
            onContext={(ev) => onContext(ev, e)}
          />
        ))}
      </div>
    </div>
  );
}
