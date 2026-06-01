// Menu contextuel au clic droit sur une entrée.
import { useEffect } from "react";

export interface MenuState {
  x: number;
  y: number;
  path: string;
  name: string;
}

interface Props {
  menu: MenuState;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onProperties: () => void;
}

export function ContextMenu({ menu, onClose, onOpen, onRename, onDelete, onProperties }: Props) {
  useEffect(() => {
    window.addEventListener("click", onClose);
    return () => window.removeEventListener("click", onClose);
  }, [onClose]);

  return (
    <div
      style={{ top: menu.y, left: menu.x }}
      className="fixed z-50 min-w-44 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
    >
      <Item label="Ouvrir" onClick={onOpen} />
      <Item label="Renommer" onClick={onRename} />
      <Item label="Supprimer" onClick={onDelete} danger />
      <div className="my-1 border-t border-[var(--color-border)]" />
      <Item label="Propriétés" onClick={onProperties} />
    </div>
  );
}

function Item({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-hover)] ${
        danger ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"
      }`}
    >
      {label}
    </button>
  );
}
