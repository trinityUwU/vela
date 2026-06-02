// Comparaison de deux dossiers : overlay listant les fichiers ajoutés / supprimés / modifiés.
import { useEffect, useMemo, useState } from "react";
import { compareDirs } from "../services/fs";
import { fmtSize } from "../services/format";
import type { DiffEntry, DiffStatus, DirCompare } from "../types";

interface Props {
  a: string;
  b: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

const STATUS_META: Record<DiffStatus, { label: string; sign: string; color: string }> = {
  only_a: { label: "Seulement à gauche", sign: "−", color: "var(--color-danger)" },
  only_b: { label: "Seulement à droite", sign: "+", color: "#4ade80" },
  modified: { label: "Modifié", sign: "~", color: "#fbbf24" },
  same: { label: "Identique", sign: "=", color: "var(--color-text-dim)" },
};

const FILTERS: { key: DiffStatus | "diff"; label: string }[] = [
  { key: "diff", label: "Différences" },
  { key: "only_a", label: "À gauche" },
  { key: "only_b", label: "À droite" },
  { key: "modified", label: "Modifiés" },
  { key: "same", label: "Identiques" },
];

function baseName(path: string): string {
  return path.split("/").filter(Boolean).pop() || path;
}

export function DirCompareViewer({ a, b, onClose, onError }: Props) {
  const [report, setReport] = useState<DirCompare | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<DiffStatus | "diff">("diff");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    compareDirs(a, b)
      .then(setReport)
      .catch((e) => { onError(String(e)); onClose(); })
      .finally(() => setLoading(false));
  }, [a, b, onClose, onError]);

  const rows = useMemo<DiffEntry[]>(() => {
    if (!report) return [];
    if (filter === "diff") return report.entries.filter((e) => e.status !== "same");
    return report.entries.filter((e) => e.status === filter);
  }, [report, filter]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(860px,94vw)] max-h-[86vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-base font-medium text-[var(--color-text)]">Comparer les dossiers</h2>
          <span className="text-xs text-[var(--color-text-dim)] truncate font-mono" title={`${a}  ↔  ${b}`}>
            {baseName(a)} ↔ {baseName(b)}
          </span>
          <div className="flex-1" />
          <button onClick={onClose} className="px-2 py-1 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Fermer</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)] py-16">Comparaison en cours…</div>
        ) : report ? (
          <>
            <div className="flex items-center gap-1 px-5 py-2.5 border-b border-[var(--color-border)] shrink-0">
              {FILTERS.map((f) => {
                const count = f.key === "diff"
                  ? report.only_a + report.only_b + report.modified
                  : report[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`px-2.5 py-1 text-xs rounded transition-colors ${
                      filter === f.key
                        ? "bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
                        : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {f.label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
              {rows.length === 0 ? (
                <div className="text-center text-[var(--color-text-dim)] py-8">Aucune entrée</div>
              ) : (
                rows.map((e) => {
                  const m = STATUS_META[e.status];
                  return (
                    <div key={e.rel} title={e.rel} className="flex items-center gap-2 px-2 py-0.5 rounded hover:bg-[var(--color-surface-hover)]">
                      <span className="shrink-0 w-3 text-center font-bold" style={{ color: m.color }}>{m.sign}</span>
                      <span className="flex-1 min-w-0 truncate text-[var(--color-text)]">
                        {e.rel}{e.is_dir ? "/" : ""}
                      </span>
                      {e.status === "modified" && (
                        <span className="shrink-0 text-[var(--color-text-dim)] tabular-nums">
                          {fmtSize(e.size_a ?? 0)} → {fmtSize(e.size_b ?? 0)}
                        </span>
                      )}
                      {e.status === "only_a" && e.size_a != null && !e.is_dir && (
                        <span className="shrink-0 text-[var(--color-text-dim)] tabular-nums">{fmtSize(e.size_a)}</span>
                      )}
                      {e.status === "only_b" && e.size_b != null && !e.is_dir && (
                        <span className="shrink-0 text-[var(--color-text-dim)] tabular-nums">{fmtSize(e.size_b)}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
