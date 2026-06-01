// Liste verticale compacte (pane gauche du mode Édition).
import type { DirEntry } from "../types";
import { FileIcon } from "./FileIcon";

interface Props {
  entries: DirEntry[];
  selected: string | null;
  onSelect: (entry: DirEntry) => void;
  onOpen: (entry: DirEntry) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
}

export function FileList({ entries, selected, onSelect, onOpen, onContext }: Props) {
  return (
    <div className="w-64 shrink-0 border-r border-[var(--color-border)] overflow-y-auto py-1">
      {entries.map((e) => (
        <button
          key={e.path}
          onClick={() => onSelect(e)}
          onDoubleClick={() => onOpen(e)}
          onContextMenu={(ev) => onContext(ev, e)}
          title={e.name}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
            selected === e.path
              ? "bg-[var(--color-surface-hover)]"
              : "hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          <span className="shrink-0"><FileIcon entry={e} size={18} /></span>
          <span className="truncate text-sm text-[var(--color-text)]">{e.name}</span>
        </button>
      ))}
    </div>
  );
}
