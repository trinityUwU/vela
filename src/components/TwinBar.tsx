// Barre d'actions du mode volet jumeau (F03) : transfère du volet actif vers l'inactif.
// La direction s'affiche selon le volet actif ; sync = ne transférer que les différences (compare_dirs).
interface Props {
  active: "a" | "b";
  selectionCount: number;
  onCopy: () => void;
  onMove: () => void;
  onSync: () => void;
}

export function TwinBar({ active, selectionCount, onCopy, onMove, onSync }: Props): React.ReactElement {
  const arrow = active === "a" ? "→" : "←";
  const disabled = selectionCount === 0;
  return (
    <div className="flex items-center justify-center gap-2 h-7 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] text-xs">
      <span className="text-[var(--color-text-dim)]">
        Volet {active === "a" ? "gauche" : "droit"} actif
        {selectionCount > 0 && ` · ${selectionCount} sélectionné${selectionCount > 1 ? "s" : ""}`}
      </span>
      <Btn label={`${arrow} Copier`} hint="F5" onClick={onCopy} disabled={disabled} />
      <Btn label={`${arrow} Déplacer`} hint="F6" onClick={onMove} disabled={disabled} />
      <Btn label="⇄ Synchroniser" onClick={onSync} />
    </div>
  );
}

function Btn({ label, hint, onClick, disabled }: {
  label: string; hint?: string; onClick: () => void; disabled?: boolean;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={hint}
      className="px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-text-dim)] disabled:opacity-40 disabled:cursor-default transition-colors"
    >
      {label}{hint && <span className="ml-1.5 opacity-60">{hint}</span>}
    </button>
  );
}
