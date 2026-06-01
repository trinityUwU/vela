// Barre supérieure : toggle des deux modes, navigation, path éditable. Zone de drag (fenêtre sans décoration).
import { useEffect, useRef, useState } from "react";
import type { Mode } from "../types";
import { ArrowUp, Refresh, Eye, FolderPlus, Search } from "./icons";
import { SearchInput } from "./SearchBar";

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
  path: string;
  showHidden: boolean;
  onUp: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  onNewFolder: () => void;
  onCrumb: (path: string) => void;
  onMove: (src: string, destDir: string) => void;
  searchOpen: boolean;
  searchQuery: string;
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
  const { mode, onMode, path, searchOpen, onMove } = props;
  return (
    <div
      data-tauri-drag-region
      className="flex items-center gap-2 px-3 h-12 border-b border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <div className="flex rounded-md bg-[var(--color-bg)] p-0.5 border border-[var(--color-border)]">
        {(["files", "edit"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={`px-3 py-1 text-xs rounded transition-colors ${
              mode === m
                ? "bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
                : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            {m === "files" ? "Fichiers" : "Édition"}
          </button>
        ))}
      </div>

      <IconBtn onClick={props.onUp} title="Dossier parent"><ArrowUp /></IconBtn>
      <IconBtn onClick={props.onRefresh} title="Rafraîchir"><Refresh /></IconBtn>

      {searchOpen ? (
        <SearchInput query={props.searchQuery} onChange={props.onSearchQuery} onClose={props.onSearchClose} />
      ) : (
        <PathBar path={path} onSubmit={props.onCrumb} onMove={onMove} />
      )}

      <IconBtn onClick={searchOpen ? props.onSearchClose : props.onSearchOpen} active={searchOpen} title="Rechercher">
        <Search />
      </IconBtn>
      <IconBtn onClick={props.onToggleHidden} active={props.showHidden} title="Fichiers cachés">
        <Eye />
      </IconBtn>
      <IconBtn onClick={props.onNewFolder} title="Nouveau dossier"><FolderPlus /></IconBtn>
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
  children, onClick, title, active,
}: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "text-[var(--color-accent)] bg-[var(--color-surface-hover)]"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {children}
    </button>
  );
}
