// Barre de recherche live : input dans la topbar, résultats superposés sous la topbar.
import { useEffect, useRef } from "react";
import type { ContentMatch, DirEntry } from "../types";
import type { SearchMode, RecentSearch } from "../hooks/useSearch";
import { FileIcon } from "./FileIcon";

interface BarProps {
  query: string;
  mode: SearchMode;
  onChange: (q: string) => void;
  onMode: (m: SearchMode) => void;
  onClose: () => void;
}

export function SearchInput({ query, mode, onChange, onMode, onClose }: BarProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  return (
    <div className="flex-1 flex items-center gap-2 h-8 px-3 rounded-md bg-[var(--color-bg)] border border-[var(--color-accent)] text-sm">
      <div className="flex gap-0.5 shrink-0">
        {(["name", "content"] as const).map((m) => (
          <button
            key={m}
            onClick={() => onMode(m)}
            className={`px-1.5 py-0.5 rounded text-[11px] transition-colors ${
              mode === m ? "bg-[var(--color-accent)] text-[var(--color-bg)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            {m === "name" ? "Nom" : "Contenu"}
          </button>
        ))}
      </div>
      <input
        ref={ref}
        value={query}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder={mode === "name" ? "Rechercher par nom…" : "Rechercher dans le contenu…"}
        className="flex-1 bg-transparent text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-dim)]"
      />
      {query && (
        <button onClick={() => onChange("")} className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-xs">✕</button>
      )}
    </div>
  );
}

interface ResultsProps {
  mode: SearchMode;
  results: DirEntry[];
  contentResults: ContentMatch[];
  searching: boolean;
  query: string;
  recents: RecentSearch[];
  onApplyRecent: (r: RecentSearch) => void;
  onClearRecents: () => void;
  onOpen: (e: DirEntry) => void;
  onNavigate: (path: string) => void;
  onOpenMatch: (path: string) => void;
}

export function SearchResults({ mode, results, contentResults, searching, query, recents, onApplyRecent, onClearRecents, onOpen, onNavigate, onOpenMatch }: ResultsProps) {
  if (!query.trim()) {
    if (recents.length === 0) return null;
    return (
      <div className="absolute top-12 left-56 right-0 z-40 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl max-h-[70vh] overflow-y-auto">
        <div className="flex items-center px-3 py-1.5 text-[10px] text-[var(--color-text-dim)] border-b border-[var(--color-border)]">
          <span className="flex-1">Recherches récentes</span>
          <button onClick={onClearRecents} className="hover:text-[var(--color-text)]">Effacer</button>
        </div>
        {recents.map((r, i) => (
          <button
            key={`${r.mode}:${r.q}:${i}`}
            onClick={() => onApplyRecent(r)}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-left hover:bg-[var(--color-surface-hover)] border-b border-[var(--color-border)]/40"
          >
            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] bg-[var(--color-bg)] text-[var(--color-text-dim)]">
              {r.mode === "name" ? "Nom" : "Contenu"}
            </span>
            <span className="flex-1 min-w-0 truncate text-sm text-[var(--color-text)]">{r.q}</span>
          </button>
        ))}
      </div>
    );
  }
  const count = mode === "name" ? results.length : contentResults.length;

  return (
    <div className="absolute top-12 left-56 right-0 z-40 border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl max-h-[70vh] overflow-y-auto">
      {searching ? (
        <div className="px-4 py-3 text-sm text-[var(--color-text-dim)]">Recherche en cours…</div>
      ) : count === 0 ? (
        <div className="px-4 py-3 text-sm text-[var(--color-text-dim)]">Aucun résultat pour « {query} »</div>
      ) : (
        <>
          <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-dim)] border-b border-[var(--color-border)]">
            {count}{count >= 200 ? "+" : ""} résultat{count > 1 ? "s" : ""}
          </div>
          {mode === "name"
            ? results.map((e) => <ResultRow key={e.path} entry={e} onOpen={onOpen} onNavigate={onNavigate} />)
            : contentResults.map((m, i) => <MatchRow key={`${m.path}:${m.line}:${i}`} match={m} onOpen={onOpenMatch} />)}
        </>
      )}
    </div>
  );
}

function MatchRow({ match, onOpen }: { match: ContentMatch; onOpen: (path: string) => void }) {
  return (
    <div
      className="flex items-baseline gap-3 px-3 py-2 hover:bg-[var(--color-surface-hover)] cursor-pointer border-b border-[var(--color-border)]/40"
      onClick={() => onOpen(match.path)}
    >
      <div className="shrink-0 w-40 truncate text-sm text-[var(--color-text)]" title={match.path}>
        {match.name}<span className="text-[var(--color-text-dim)]">:{match.line}</span>
      </div>
      <div className="flex-1 min-w-0 truncate text-[12px] font-mono text-[var(--color-text-dim)]">{match.text}</div>
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
