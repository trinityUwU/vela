// Modal de création d'archive : nom + format (ZIP / TAR.GZ / 7Z / RAR) + mot de passe optionnel.
import { useState } from "react";
import type { ArchiveFormat } from "../services/fs";

interface Props {
  defaultName: string;
  count: number;
  onSubmit: (name: string, format: ArchiveFormat, password?: string) => void;
  onCancel: () => void;
}

const FORMATS: { id: ArchiveFormat; label: string; ext: string; encrypt: boolean }[] = [
  { id: "zip", label: "ZIP", ext: ".zip", encrypt: true },
  { id: "targz", label: "TAR.GZ", ext: ".tar.gz", encrypt: false },
  { id: "7z", label: "7Z", ext: ".7z", encrypt: true },
  { id: "rar", label: "RAR", ext: ".rar", encrypt: true },
];

export function CompressModal({ defaultName, count, onSubmit, onCancel }: Props) {
  const [format, setFormat] = useState<ArchiveFormat>("zip");
  const [name, setName] = useState(defaultName);
  const [password, setPassword] = useState("");
  const current = FORMATS.find((f) => f.id === format)!;

  const submit = (): void => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const full = trimmed.endsWith(current.ext) ? trimmed : trimmed + current.ext;
    onSubmit(full, format, current.encrypt ? password.trim() || undefined : undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onCancel}>
      <div
        className="w-96 p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">
          Compresser {count > 1 ? `${count} éléments` : "1 élément"}
        </h2>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onCancel(); }}
          placeholder="nom de l'archive"
          className="w-full px-2 py-1.5 mb-3 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
        <div className="grid grid-cols-4 gap-2 mb-3">
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFormat(f.id)}
              className={`px-2 py-1.5 rounded text-sm transition-colors ${
                format === f.id
                  ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                  : "bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="password"
          value={password}
          disabled={!current.encrypt}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder={current.encrypt ? "Mot de passe (optionnel)" : "Mot de passe non supporté pour ce format"}
          className="w-full px-2 py-1.5 mb-4 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] disabled:opacity-40"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"
          >
            Annuler
          </button>
          <button
            onClick={submit}
            className="px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)]"
          >
            Compresser
          </button>
        </div>
      </div>
    </div>
  );
}
