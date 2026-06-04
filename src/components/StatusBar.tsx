// Barre d'état du listing : nombre d'éléments, sélection (count + taille), espace disque du volume courant.
import { fmtSize } from "../services/format";

interface Props {
  total: number;
  selectedCount: number;
  selectedSize: number;
  free: number | null;
  totalDisk: number | null;
}

export function StatusBar({ total, selectedCount, selectedSize, free, totalDisk }: Props): React.ReactElement {
  return (
    <div className="shrink-0 flex items-center gap-3 px-3 h-6 border-t border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] text-[var(--color-text-dim)] select-none">
      <span>{total} élément{total > 1 ? "s" : ""}</span>
      {selectedCount > 0 && (
        <span className="text-[var(--color-text)]">
          {selectedCount} sélectionné{selectedCount > 1 ? "s" : ""}
          {selectedSize > 0 ? ` · ${fmtSize(selectedSize)}` : ""}
        </span>
      )}
      <div className="flex-1" />
      {free != null && totalDisk != null && (
        <span title="Espace disponible sur le volume">{fmtSize(free)} libres sur {fmtSize(totalDisk)}</span>
      )}
    </div>
  );
}
