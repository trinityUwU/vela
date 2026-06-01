// Barre de recherche live : input dans la topbar, résultats superposés sous la topbar.
import { useEffect, useRef } from "react";
import type { DirEntry } from "../types";
import { FileIcon } from "./FileIcon";

interface BarProps {
  query: string;
  onChange: (q: string) => void;
  onClose: () => void;
}

export function SearchInput({ query, onChange, onClose }: BarProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="flex-1 flex items-center gap-2 h-8 px-3 rounded-md bg-[var(--color-bg)] border border-[var(--color-accent)] text-sm">
      <span className="text-[var(--color-text-dim)] text-xs">🔍</span>
      <input
        ref={ref}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Rechercher (min. 2 caractères)…"
        className="flex-1 bg-transparent text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-dim)]"
      />
      {query && (
        <button onClick={() => onChange("")} className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-xs">✕</button>
      )}
    </div>
  );
}

interface ResultsProps {
  results: DirEntry[];
  searching: boolean;
  query: string;
  onOpen: (e: DirEntry) => void;
  onNavigate: (path: string) => void;
}

export function SearchResults({ results, searching, query, onOpen, onNavigate }: ResultsProps) {
  if (!query.trim()) return null;

  return (
    <div className="absolute top-12 left-56 right-0 z-40 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl max-h-[70vh] overflow-y-auto">
      {searching ? (
        <div className="px-4 py-3 text-sm text-[var(--color-text-dim)]">Recherche en cours…</div>
      ) : results.length === 0 ? (
        <div className="px-4 py-3 text-sm text-[var(--color-text-dim)]">Aucun résultat pour « {query} »</div>
      ) : (
        <>
          <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-dim)] border-b border-[var(--color-border)]">
            {results.length}{results.length >= 200 ? "+" : ""} résultat{results.length > 1 ? "s" : ""}
          </div>
          {results.map((e) => (
            <ResultRow key={e.path} entry={e} onOpen={onOpen} onNavigate={onNavigate} />
          ))}
        </>
      )}
    </div>
  );
}

function ResultRow({ entry, onOpen, onNavigate }: {
  entry: DirEntry;
  onOpen: (e: DirEntry) => void;
  onNavigate: (path: string) => void;
}) {
  const parent = entry.path.slice(0, entry.path.lastIndexOf("/")) || "/";

  return (
    <div className="group flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-surface-hover)] cursor-pointer border-b border-[var(--color-border)]/40"
      onClick={() => onOpen(entry)}
    >
      <span className="shrink-0"><FileIcon entry={entry} size={20} /></span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-[var(--color-text)] truncate">{entry.name}</div>
        <div className="text-[11px] text-[var(--color-text-dim)] truncate">{parent}</div>
      </div>
      <button
        onClick={(ev) => { ev.stopPropagation(); onNavigate(parent); }}
        className="hidden group-hover:block text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)] px-2 py-0.5 rounded shrink-0"
        title="Ouvrir le dossier parent"
      >
        → dossier
      </button>
    </div>
  );
}
