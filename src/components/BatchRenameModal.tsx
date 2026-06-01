// Renommage par lot : recherche/remplacement littéral sur les noms, avec aperçu live.
import { useMemo, useState } from "react";

interface Props {
  names: string[];
  onSubmit: (renames: { from: string; to: string }[]) => void;
  onCancel: () => void;
}

function applyRename(name: string, find: string, replace: string, index: number): string {
  let out = find ? name.split(find).join(replace) : name;
  out = out.replace(/\{n\}/g, String(index + 1).padStart(2, "0"));
  return out;
}

export function BatchRenameModal({ names, onSubmit, onCancel }: Props) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");

  const preview = useMemo(
    () => names.map((name, i) => ({ from: name, to: applyRename(name, find, replace, i) })),
    [names, find, replace],
  );

  const changed = preview.filter((p) => p.from !== p.to);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-[32rem] p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Renommer {names.length} éléments</h2>
        <div className="flex gap-2 mb-3">
          <input
            autoFocus
            value={find}
            onChange={(e) => setFind(e.target.value)}
            placeholder="Rechercher"
            className="flex-1 px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            placeholder="Remplacer par"
            className="flex-1 px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
        </div>
        <p className="text-[11px] text-[var(--color-text-dim)] mb-2">
          Jeton <code className="text-[var(--color-text)]">{"{n}"}</code> = numéro séquentiel (01, 02…)
        </p>
        <div className="max-h-52 overflow-y-auto rounded border border-[var(--color-border)] mb-4 divide-y divide-[var(--color-border)]/40">
          {preview.map((p) => (
            <div key={p.from} className="flex items-center gap-2 px-2 py-1 text-[12px]">
              <span className="flex-1 truncate text-[var(--color-text-dim)]">{p.from}</span>
              <span className="text-[var(--color-text-dim)]">→</span>
              <span className={`flex-1 truncate ${p.from !== p.to ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)]"}`}>{p.to}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[11px] text-[var(--color-text-dim)]">{changed.length} renommage(s)</span>
          <div className="flex gap-2">
            <button onClick={onCancel} className="px-3 py-1.5 rounded text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]">Annuler</button>
            <button
              onClick={() => onSubmit(changed)}
              disabled={changed.length === 0}
              className="px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-40"
            >
              Renommer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
