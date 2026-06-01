// Aperçu rapide (Espace) : overlay réutilisant l'éditeur en lecture, sans entrer en mode Édition.
import { useEffect } from "react";
import type { DirEntry } from "../types";
import { Editor } from "./Editor";

interface Props {
  entry: DirEntry;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function QuickLook({ entry, onClose, onError }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === " ") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-8" onClick={onClose}>
      <div
        className="w-[80vw] h-[85vh] flex flex-col rounded-lg overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-3 h-9 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <span className="text-sm text-[var(--color-text)] truncate">{entry.name}</span>
          <button onClick={onClose} className="text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-sm px-2">✕</button>
        </div>
        <div className="flex-1 min-h-0 flex">
          <Editor entry={entry} onClose={onClose} onError={onError} />
        </div>
      </div>
    </div>
  );
}
