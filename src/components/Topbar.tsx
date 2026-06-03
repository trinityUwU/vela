// Barre supérieure : sélecteur de profil, navigation, path éditable. Zone de drag (fenêtre sans décoration).
import { useEffect, useRef, useState } from "react";
import type { Profile } from "../types";
import type { SearchMode } from "../hooks/useSearch";
import { ArrowUp, Refresh, Eye, Search, Trash, TerminalIcon, ChevronLeft, ChevronRight, GridIcon, ListIcon, Sliders, Globe } from "./icons";
import { SearchInput } from "./SearchBar";

export type View = "grid" | "list";

interface Props {
  profiles: Profile[];
  activeId: string;
  onSwitchProfile: (id: string) => void;
  onEditProfiles: () => void;
  showViewToggle: boolean;
  path: string;
  showHidden: boolean;
  view: View;
  onView: (v: View) => void;
  onBack: () => void;
  onForward: () => void;
  canBack: boolean;
  canForward: boolean;
  onUp: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  onCrumb: (path: string) => void;
  onMove: (src: string, destDir: string) => void;
  inTrash: boolean;
  trashCount: number;
  onEmptyTrash: () => void;
  termOpen: boolean;
  onToggleTerm: () => void;
  browserOpen: boolean;
  onToggleBrowser: () => void;
  searchOpen: boolean;
  searchQuery: string;
  searchMode: SearchMode;
  onSearchMode: (m: SearchMode) => void;
  onSearchOpen: () => void;
  onSearchQuery: (q: string) => void;
  onSearchClose: () => void;
}

function crumbs(path: string): { label: string; path: string }[] {
  const parts = path.split("/").filter(Boolean);
  const acc: { label: string; path: string }[] = [{ label: "/", path: "/" }];
  let cur = "";
  for (const p of parts) {
    cur += "/" + p;
    acc.push({ label: p, path: cur });
  }
  return acc;
}

export function Topbar(props: Props) {
  const { profiles, activeId, onSwitchProfile, path, searchOpen, onMove } = props;
  return (
    <div
      data-tauri-drag-region
      className="flex items-center gap-2 px-3 h-12 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="flex rounded-md bg-[var(--color-bg)] p-0.5 border border-[var(--color-border)]">
        {profiles.map((p) => (
          <button
            key={p.id}
            onClick={() => onSwitchProfile(p.id)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              activeId === p.id
                ? "bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
                : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
      <IconBtn onClick={props.onEditProfiles} title="Gérer les profils"><Sliders /></IconBtn>

      <IconBtn onClick={props.onBack} title="Précédent (Alt+←)" disabled={!props.canBack}><ChevronLeft /></IconBtn>
      <IconBtn onClick={props.onForward} title="Suivant (Alt+→)" disabled={!props.canForward}><ChevronRight /></IconBtn>
      <IconBtn onClick={props.onUp} title="Dossier parent"><ArrowUp /></IconBtn>
      <IconBtn onClick={props.onRefresh} title="Rafraîchir"><Refresh /></IconBtn>

      {searchOpen ? (
        <SearchInput query={props.searchQuery} mode={props.searchMode} onChange={props.onSearchQuery} onMode={props.onSearchMode} onClose={props.onSearchClose} />
      ) : (
        <PathBar path={path} onSubmit={props.onCrumb} onMove={onMove} />
      )}

      {props.inTrash && (
        <button
          onClick={props.onEmptyTrash}
          disabled={props.trashCount === 0}
          title="Vider la corbeille"
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs text-[var(--color-danger)] border border-[var(--color-danger)]/40 hover:bg-[var(--color-danger)]/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent shrink-0"
        >
          <Trash width={15} height={15} />
          Vider{props.trashCount > 0 ? ` (${props.trashCount})` : ""}
        </button>
      )}

      <IconBtn onClick={searchOpen ? props.onSearchClose : props.onSearchOpen} active={searchOpen} title="Rechercher">
        <Search />
      </IconBtn>
      {props.showViewToggle && (
        <IconBtn
          onClick={() => props.onView(props.view === "grid" ? "list" : "grid")}
          title={props.view === "grid" ? "Vue liste" : "Vue grille"}
        >
          {props.view === "grid" ? <ListIcon /> : <GridIcon />}
        </IconBtn>
      )}
      <IconBtn onClick={props.onToggleHidden} active={props.showHidden} title="Fichiers cachés">
        <Eye />
      </IconBtn>
      <IconBtn onClick={props.onToggleBrowser} active={props.browserOpen} title="Navigateur">
        <Globe />
      </IconBtn>
      <IconBtn onClick={props.onToggleTerm} active={props.termOpen} title="Terminal (Ctrl+`)">
        <TerminalIcon />
      </IconBtn>
    </div>
  );
}

function PathBar({ path, onSubmit, onMove }: {
  path: string;
  onSubmit: (p: string) => void;
  onMove: (src: string, destDir: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(path);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setValue(path);
      ref.current?.focus();
      ref.current?.select();
    }
  }, [editing, path]);

  if (editing) {
    return (
      <input
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSubmit(value.trim());
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        className="flex-1 h-8 px-3 rounded-md bg-[var(--color-bg)] border border-[var(--color-accent)] text-sm text-[var(--color-text)] outline-none font-mono"
      />
    );
  }

  return (
    <div
      onClick={() => setEditing(true)}
      title="Cliquer pour saisir un chemin"
      className="flex-1 flex items-center gap-1 overflow-x-auto h-8 px-3 rounded-md bg-[var(--color-bg)]/40 border border-transparent hover:border-[var(--color-border)] text-sm text-[var(--color-text-dim)] cursor-text"
    >
      {crumbs(path).map((c, i) => (
        <span key={c.path} className="flex items-center gap-1 whitespace-nowrap">
          {i > 0 && <span className="opacity-40">/</span>}
          <button
            onClick={(e) => { e.stopPropagation(); onSubmit(c.path); }}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(c.path); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              const src = e.dataTransfer.getData("application/vela");
              if (src && src !== c.path) onMove(src, c.path);
            }}
            className={`hover:text-[var(--color-text)] transition-colors px-0.5 rounded ${
              dragOver === c.path ? "text-[var(--color-accent)] bg-[var(--color-accent-dim)]/20" : ""
            }`}
          >
            {c.label}
          </button>
        </span>
      ))}
    </div>
  );
}

function IconBtn({
  children, onClick, title, active, disabled,
}: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[var(--color-text-dim)] ${
        active
          ? "text-[var(--color-accent)] bg-[var(--color-surface-hover)]"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {children}
    </button>
  );
}
