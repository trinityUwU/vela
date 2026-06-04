// Barre de tri et filtre — compacte, toujours visible sous la topbar.
import { useState } from "react";
import type { SortBy, SortState, FilterKind } from "../hooks/useSort";
import type { ProjectInfo } from "../hooks/useProject";

interface Props {
  sort: SortState;
  onToggleBy: (by: SortBy) => void;
  onFilter: (f: FilterKind) => void;
  onToggleDirsFirst: () => void;
  gitOverlay: boolean;
  onToggleGit: () => void;
  inRepo: boolean;
  project?: ProjectInfo;
  onRunTask?: (command: string) => void;
}

const SORT_LABELS: { by: SortBy; label: string }[] = [
  { by: "name",      label: "Nom" },
  { by: "modified",  label: "Date" },
  { by: "size",      label: "Taille" },
  { by: "extension", label: "Type" },
];

const FILTER_LABELS: { f: FilterKind; label: string }[] = [
  { f: "all",   label: "Tout" },
  { f: "dirs",  label: "Dossiers" },
  { f: "files", label: "Fichiers" },
];

export function SortBar({ sort, onToggleBy, onFilter, onToggleDirsFirst, gitOverlay, onToggleGit, inRepo, project, onRunTask }: Props) {
  return (
    <div className="flex items-center gap-3 px-3 h-8 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0 text-[11px]">
      {/* Tri */}
      <span className="text-[var(--color-text-dim)] shrink-0">Trier :</span>
      <div className="flex items-center gap-0.5">
        {SORT_LABELS.map(({ by, label }) => (
          <SortBtn
            key={by}
            label={label}
            active={sort.by === by}
            dir={sort.by === by ? sort.dir : null}
            onClick={() => onToggleBy(by)}
          />
        ))}
      </div>

      <div className="w-px h-4 bg-[var(--color-border)] shrink-0" />

      {/* Filtre */}
      <div className="flex items-center gap-0.5">
        {FILTER_LABELS.map(({ f, label }) => (
          <FilterBtn
            key={f}
            label={label}
            active={sort.filter === f}
            onClick={() => onFilter(f)}
          />
        ))}
      </div>

      <div className="w-px h-4 bg-[var(--color-border)] shrink-0" />

      {/* Dossiers en tête */}
      <button
        onClick={onToggleDirsFirst}
        className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
          sort.dirsFirst
            ? "text-[var(--color-accent)]"
            : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        }`}
      >
        <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
          sort.dirsFirst ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-border)]"
        }`}>
          {sort.dirsFirst && <span className="text-white text-[8px] leading-none">✓</span>}
        </span>
        Dossiers en tête
      </button>

      {inRepo && (
        <>
          <div className="w-px h-4 bg-[var(--color-border)] shrink-0" />
          <button
            onClick={onToggleGit}
            title="Afficher l'état git sur les fichiers et dossiers"
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              gitOverlay ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
            }`}
          >
            <span className={`w-3 h-3 rounded-sm border flex items-center justify-center shrink-0 ${
              gitOverlay ? "border-[var(--color-accent)] bg-[var(--color-accent)]" : "border-[var(--color-border)]"
            }`}>
              {gitOverlay && <span className="text-white text-[8px] leading-none">✓</span>}
            </span>
            Git
          </button>
        </>
      )}

      {project && project.kind && project.tasks.length > 0 && onRunTask && (
        <>
          <div className="flex-1" />
          <ProjectBadge project={project} onRunTask={onRunTask} />
        </>
      )}
    </div>
  );
}

function ProjectBadge({ project, onRunTask }: { project: ProjectInfo; onRunTask: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[var(--color-accent)] hover:bg-[var(--color-surface-hover)]"
        title="Tâches du projet"
      >
        ⬡ {project.kind} · {project.tasks.length}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute z-50 top-6 right-0 min-w-44 max-h-72 overflow-auto p-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
            {project.tasks.map((t) => (
              <button
                key={t.command}
                onClick={() => { onRunTask(t.command); setOpen(false); }}
                className="w-full text-left px-2 py-1 text-xs rounded text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] font-mono truncate"
              >
                {t.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SortBtn({ label, active, dir, onClick }: {
  label: string; active: boolean; dir: "asc" | "desc" | null; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded transition-colors ${
        active
          ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {label}
      {active && <span className="ml-0.5 opacity-70">{dir === "asc" ? "↑" : "↓"}</span>}
    </button>
  );
}

function FilterBtn({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded transition-colors ${
        active
          ? "bg-[var(--color-accent-dim)]/30 text-[var(--color-accent)]"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {label}
    </button>
  );
}
