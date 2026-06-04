// Menu contextuel sur zone vide (fond du dossier courant).
import { useEffect } from "react";
import { useMenuPosition } from "../hooks/useMenuPosition";

interface Props {
  x: number;
  y: number;
  showHidden: boolean;
  onClose: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  onToggleHidden: () => void;
  onPinCurrent: () => void;
  onProperties: () => void;
  onPaste?: () => void;
  canPaste: boolean;
}

export function BgContextMenu({ x, y, showHidden, onClose, onNewFile, onNewFolder, onRefresh, onToggleHidden, onPinCurrent, onProperties, onPaste, canPaste }: Props) {
  const { ref, pos } = useMenuPosition(x, y);

  useEffect(() => {
    window.addEventListener("click", onClose);
    return () => window.removeEventListener("click", onClose);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left, maxHeight: "calc(100vh - 16px)" }}
      className="fixed z-50 min-w-52 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-y-auto"
    >
      <Item label="Nouveau fichier" onClick={onNewFile} />
      <Item label="Nouveau dossier" onClick={onNewFolder} />
      {canPaste && <Item label="Coller" onClick={() => onPaste?.()} />}
      <Item label="Actualiser" onClick={onRefresh} />
      <Divider />
      <Item
        label={showHidden ? "Masquer les fichiers cachés" : "Afficher les fichiers cachés"}
        onClick={onToggleHidden}
      />
      <Item label="Épingler ce dossier dans les favoris" onClick={onPinCurrent} />
      <Divider />
      <Item label="Propriétés du dossier" onClick={onProperties} />
    </div>
  );
}

function Item({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-hover)] text-[var(--color-text)] truncate"
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-[var(--color-border)]" />;
}
