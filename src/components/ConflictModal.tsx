// Modale de résolution des conflits de noms avant copie/déplacement. Un choix par fichier
// (remplacer / ignorer / garder les deux / fusionner) + « appliquer à tout ». Zéro perte garantie côté Rust.
import { useEffect, useState } from "react";
import type { Conflict, ConflictResolution } from "../services/fs";
import { fmtSize } from "../services/format";

interface Props {
  conflicts: Conflict[];
  onResolve: (resolutions: Record<string, ConflictResolution>) => void;
  onCancel: () => void;
}

const OPTS: { key: ConflictResolution; label: string; dirOnly?: boolean }[] = [
  { key: "keep", label: "Garder les deux" },
  { key: "replace", label: "Remplacer" },
  { key: "skip", label: "Ignorer" },
  { key: "merge", label: "Fusionner", dirOnly: true },
];

export function ConflictModal({ conflicts, onResolve, onCancel }: Props): React.ReactElement {
  const [choices, setChoices] = useState<Record<string, ConflictResolution>>(
    () => Object.fromEntries(conflicts.map((c) => [c.name, "keep" as ConflictResolution])),
  );

  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  const applyAll = (r: ConflictResolution): void =>
    setChoices(Object.fromEntries(conflicts.map((c) => [c.name, r])));
  const set = (name: string, r: ConflictResolution): void => setChoices((p) => ({ ...p, [name]: r }));

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(680px,94vw)] max-h-[85vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="px-5 h-12 flex items-center border-b border-[var(--color-border)] shrink-0">
          <h2 className="text-sm font-medium text-[var(--color-text)]">
            {conflicts.length} conflit{conflicts.length > 1 ? "s" : ""} de nom
          </h2>
        </div>

        <div className="px-5 py-2 flex items-center gap-2 text-xs border-b border-[var(--color-border)] shrink-0">
          <span className="text-[var(--color-text-dim)]">Appliquer à tout :</span>
          {OPTS.map((o) => (
            <button
              key={o.key}
              onClick={() => applyAll(o.key)}
              className="px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-accent)]"
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 flex flex-col gap-3">
          {conflicts.map((c) => (
            <div key={c.name} className="flex flex-col gap-1.5">
              <div className="text-sm text-[var(--color-text)] truncate" title={c.destPath}>
                {c.srcIsDir ? "📁 " : ""}{c.name}
              </div>
              <div className="text-[11px] text-[var(--color-text-dim)] flex gap-4">
                <span>existant : {c.destIsDir ? "dossier" : fmtSize(c.destSize)}</span>
                <span>nouveau : {c.srcIsDir ? "dossier" : fmtSize(c.srcSize)}</span>
              </div>
              <div className="flex gap-1">
                {OPTS.filter((o) => !o.dirOnly || (c.srcIsDir && c.destIsDir)).map((o) => (
                  <button
                    key={o.key}
                    onClick={() => set(c.name, o.key)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      choices[c.name] === o.key
                        ? "bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
                        : "bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] flex justify-end gap-2 shrink-0">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            Annuler
          </button>
          <button
            onClick={() => onResolve(choices)}
            className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
