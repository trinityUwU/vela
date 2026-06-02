// Analyse disque d'un dossier : overlay listant les plus gros fichiers + les doublons.
import { useEffect, useState } from "react";
import { analyzeDisk } from "../services/fs";
import { fmtSize } from "../services/format";
import type { DiskReport } from "../types";

interface Props {
  path: string;
  onClose: () => void;
  onReveal: (path: string) => void;
  onError: (msg: string) => void;
}

function parentDir(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash > 0 ? path.slice(0, slash) : "/";
}

export function DiskAnalyzer({ path, onClose, onReveal, onError }: Props) {
  const [report, setReport] = useState<DiskReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"largest" | "dups">("largest");

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    setLoading(true);
    analyzeDisk(path)
      .then(setReport)
      .catch((e) => { onError(String(e)); onClose(); })
      .finally(() => setLoading(false));
  }, [path, onClose, onError]);

  const wasted = report ? report.duplicates.reduce((s, g) => s + g.size * (g.paths.length - 1), 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(820px,94vw)] max-h-[86vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center gap-3 px-5 h-14 border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-base font-medium text-[var(--color-text)]">Analyse de l'espace</h2>
          <span className="text-xs text-[var(--color-text-dim)] truncate font-mono">{path}</span>
          <div className="flex-1" />
          <button onClick={onClose} className="px-2 py-1 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Fermer</button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)] py-16">Analyse en cours…</div>
        ) : report ? (
          <>
            <div className="flex items-center gap-6 px-5 py-3 border-b border-[var(--color-border)] text-xs text-[var(--color-text-dim)] shrink-0">
              <span><b className="text-[var(--color-text)]">{fmtSize(report.total_size)}</b> au total</span>
              <span><b className="text-[var(--color-text)]">{report.file_count.toLocaleString("fr")}</b> fichiers</span>
              {wasted > 0 && <span><b className="text-[var(--color-danger)]">{fmtSize(wasted)}</b> récupérables (doublons)</span>}
            </div>

            <div className="flex gap-1 px-5 pt-3 shrink-0">
              <Tab label={`Plus gros fichiers (${report.largest.length})`} active={tab === "largest"} onClick={() => setTab("largest")} />
              <Tab label={`Doublons (${report.duplicates.length})`} active={tab === "dups"} onClick={() => setTab("dups")} />
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-3">
              {tab === "largest" ? (
                <ul className="space-y-0.5">
                  {report.largest.map((f) => (
                    <li key={f.path}>
                      <button
                        onClick={() => { onReveal(parentDir(f.path)); onClose(); }}
                        title={f.path}
                        className="w-full flex items-center gap-3 px-2 py-1 rounded text-left hover:bg-[var(--color-surface-hover)]"
                      >
                        <span className="flex-1 min-w-0 truncate text-sm text-[var(--color-text)]">{f.name}</span>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-dim)]">{fmtSize(f.size)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : report.duplicates.length === 0 ? (
                <div className="text-sm text-[var(--color-text-dim)] py-8 text-center">Aucun doublon détecté</div>
              ) : (
                <ul className="space-y-3">
                  {report.duplicates.map((g, i) => (
                    <li key={i} className="rounded border border-[var(--color-border)]">
                      <div className="px-3 py-1.5 text-xs text-[var(--color-text-dim)] border-b border-[var(--color-border)]">
                        {g.paths.length} copies · {fmtSize(g.size)} chacune · <span className="text-[var(--color-danger)]">{fmtSize(g.size * (g.paths.length - 1))} récupérables</span>
                      </div>
                      {g.paths.map((p) => (
                        <button
                          key={p}
                          onClick={() => { onReveal(parentDir(p)); onClose(); }}
                          title={p}
                          className="w-full text-left px-3 py-1 text-xs font-mono truncate text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                        >
                          {p}
                        </button>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded-t border-b-2 transition-colors ${
        active
          ? "border-[var(--color-accent)] text-[var(--color-text)]"
          : "border-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      }`}
    >
      {label}
    </button>
  );
}
