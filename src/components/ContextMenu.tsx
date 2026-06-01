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
}

export function ContextMenu({ menu, onClose, onOpen, onRename, onDelete }: Props) {
  useEffect(() => {
    window.addEventListener("click", onClose);
    return () => window.removeEventListener("click", onClose);
  }, [onClose]);

  const items = [
    { label: "Ouvrir", fn: onOpen },
    { label: "Renommer", fn: onRename },
    { label: "Supprimer", fn: onDelete, danger: true },
  ];

  return (
    <div
      style={{ top: menu.y, left: menu.x }}
      className="fixed z-50 min-w-40 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
    >
      {items.map((it) => (
        <button
          key={it.label}
          onClick={it.fn}
          className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-hover)] ${
            it.danger ? "text-[var(--color-danger)]" : "text-[var(--color-text)]"
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}
