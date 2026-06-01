// Modal de propriétés : métadonnées complètes d'un fichier ou dossier.
import { useEffect, useState } from "react";
import { getEntryProps } from "../services/fs";
import type { DirEntry, EntryProps } from "../types";

interface Props {
  entry: DirEntry;
  onClose: () => void;
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} Ko`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(2)} Mo`;
  return `${(b / 1073741824).toFixed(2)} Go`;
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtOctal(n: number): string {
  return n.toString(8).padStart(3, "0");
}

function fmtType(props: EntryProps): string {
  if (props.is_dir) return "Dossier";
  if (!props.extension) return "Fichier";
  return `Fichier .${props.extension}`;
}

export function PropertiesModal({ entry, onClose }: Props) {
  const [props, setProps] = useState<EntryProps | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEntryProps(entry.path)
      .then(setProps)
      .catch((e) => setError(String(e)));
  }, [entry.path]);

  const parent = entry.path.slice(0, entry.path.lastIndexOf("/")) || "/";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-96 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text)] truncate">{entry.name}</h2>
        </div>

        <div className="px-5 py-4 space-y-2.5">
          {error ? (
            <p className="text-sm text-[var(--color-danger)]">{error}</p>
          ) : !props ? (
            <p className="text-sm text-[var(--color-text-dim)]">Chargement…</p>
          ) : (
            <>
              <Row label="Type" value={fmtType(props)} />
              <Row label="Emplacement" value={parent} mono />
              <Row
                label="Taille"
                value={`${fmtSize(props.size)}${props.is_dir ? ` (${props.size.toLocaleString("fr-FR")} octets)` : ""}`}
              />
              <Row label="Modifié" value={fmtDate(props.modified)} />
              <Row
                label="Permissions"
                value={`${props.permissions}  (${fmtOctal(props.permissions_octal)})`}
                mono
              />
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm rounded-md bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:bg-[var(--color-border)] transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="w-28 shrink-0 text-[var(--color-text-dim)]">{label}</span>
      <span className={`flex-1 text-[var(--color-text)] break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
