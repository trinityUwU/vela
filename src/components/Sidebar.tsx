// Sidebar gauche : raccourcis (home, dossiers XDG, points de montage).
import type { Place } from "../types";
import { Home, Folder, Drive } from "./icons";

interface Props {
  places: Place[];
  cwd: string;
  onSelect: (path: string) => void;
}

function placeIcon(kind: Place["kind"]) {
  if (kind === "home") return <Home />;
  if (kind === "mount") return <Drive />;
  return <Folder />;
}

export function Sidebar({ places, cwd, onSelect }: Props) {
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto py-2">
      <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-[var(--color-text-dim)]">
        Emplacements
      </div>
      {places.map((p) => {
        const active = cwd === p.path;
        return (
          <button
            key={p.path}
            onClick={() => onSelect(p.path)}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors ${
              active
                ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
                : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
            }`}
          >
            <span className="shrink-0 opacity-80">{placeIcon(p.kind)}</span>
            <span className="truncate">{p.name}</span>
          </button>
        );
      })}
    </aside>
  );
}
