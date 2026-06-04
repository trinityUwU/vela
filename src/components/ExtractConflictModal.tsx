// Conflit d'extraction : le dossier de destination existe déjà. Remplacer (écrase par-dessus, sans
// copie temporaire), garder les deux (dossier séparé), ou annuler. Aucune perte silencieuse.
import { useEffect } from "react";
import { baseName } from "../services/path-util";

interface Props {
  dest: string;
  onReplace: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export function ExtractConflictModal({ dest, onReplace, onKeepBoth, onCancel }: Props): React.ReactElement {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(460px,92vw)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 flex flex-col gap-4"
      >
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text)]">Le dossier existe déjà</h2>
          <p className="mt-1 text-xs text-[var(--color-text-dim)]">
            « {baseName(dest)} » est déjà présent. Que faire ?
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <button
            onClick={onReplace}
            className="text-left px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)] text-sm text-[var(--color-text)]"
          >
            Remplacer
            <span className="block text-[11px] text-[var(--color-text-dim)]">Extrait par-dessus le dossier existant (sans copie temporaire).</span>
          </button>
          <button
            onClick={onKeepBoth}
            className="text-left px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] hover:border-[var(--color-accent)] text-sm text-[var(--color-text)]"
          >
            Garder les deux
            <span className="block text-[11px] text-[var(--color-text-dim)]">Extrait dans un dossier séparé « {baseName(dest)} (1) ».</span>
          </button>
        </div>
        <div className="flex justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
