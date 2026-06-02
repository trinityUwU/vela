// Zone d'édition multi-onglets : barre d'onglets + une instance Editor par fichier (inactifs masqués).
import { Editor } from "./Editor";
import type { DirEntry } from "../types";

interface Props {
  tabs: DirEntry[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onError: (msg: string) => void;
  editPath?: string | null;
}

export function EditorArea({ tabs, activePath, onSelect, onClose, onError, editPath = null }: Props) {
  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]">
        Sélectionne un fichier pour l'éditer
      </div>
    );
  }
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-stretch h-8 bg-[var(--color-surface)] border-b border-[var(--color-border)] overflow-x-auto shrink-0">
        {tabs.map((t) => (
          <div
            key={t.path}
            onClick={() => onSelect(t.path)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(t.path); } }}
            className={`group flex items-center gap-1.5 px-3 text-xs cursor-pointer whitespace-nowrap border-r border-[var(--color-border)] ${
              t.path === activePath
                ? "bg-[var(--color-bg)] text-[var(--color-text)]"
                : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            <span className="truncate max-w-48">{t.name}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onClose(t.path); }}
              className="opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)]"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <div className="flex-1 min-h-0 relative">
        {tabs.map((t) => (
          <div key={t.path} className={`absolute inset-0 flex ${t.path === activePath ? "" : "hidden"}`}>
            <Editor
              entry={t}
              active={t.path === activePath}
              onClose={() => onClose(t.path)}
              onError={onError}
              editPath={editPath}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
