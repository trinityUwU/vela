// Menu contextuel au clic droit sur une entrée (fichier ou dossier).
import { useEffect } from "react";
import { previewKind } from "../services/file-kind";

export interface MenuState {
  x: number;
  y: number;
  path: string;
  name: string;
  isDir: boolean;
  extension: string;
  cwd: string;
}

interface Props {
  menu: MenuState;
  onClose: () => void;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onProperties: () => void;
  onExtractHere?: () => void;
  onExtractTo?: () => void;
}

function relativePath(path: string, cwd: string): string {
  const base = cwd.endsWith("/") ? cwd : cwd + "/";
  return path.startsWith(base) ? path.slice(base.length) : path.split("/").pop() ?? path;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export function ContextMenu({ menu, onClose, onOpen, onRename, onDelete, onProperties, onExtractHere, onExtractTo }: Props) {
  useEffect(() => {
    window.addEventListener("click", onClose);
    return () => window.removeEventListener("click", onClose);
  }, [onClose]);

  const rel = relativePath(menu.path, menu.cwd);
  const isArchive = !menu.isDir && previewKind(menu.extension) === "archive";

  return (
    <div
      style={{ top: menu.y, left: menu.x }}
      className="fixed z-50 min-w-48 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
    >
      <Item label="Ouvrir" onClick={onOpen} />
      {isArchive && (
        <>
          <Divider />
          <Item label="Extraire ici" onClick={() => { onExtractHere?.(); onClose(); }} />
          <Item label="Extraire vers…" onClick={() => { onExtractTo?.(); onClose(); }} />
        </>
      )}
      <Divider />
      <Item label="Copier le chemin" onClick={() => { copyToClipboard(menu.path); onClose(); }} />
      <Item label={`Copier le chemin relatif  — ${rel}`} onClick={() => { copyToClipboard(rel); onClose(); }} dim />
      <Divider />
      <Item label="Renommer" onClick={onRename} />
      <Item label="Supprimer" onClick={onDelete} danger />
      <Divider />
      <Item label="Propriétés" onClick={onProperties} />
    </div>
  );
}

function Item({ label, onClick, danger, dim }: {
  label: string; onClick: () => void; danger?: boolean; dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-hover)] truncate ${
        danger ? "text-[var(--color-danger)]" : dim ? "text-[var(--color-text-dim)]" : "text-[var(--color-text)]"
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-[var(--color-border)]" />;
}
