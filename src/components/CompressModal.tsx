// Modal de création d'archive : nom de sortie + choix du format (ZIP / TAR.GZ).
import { useState } from "react";

interface Props {
  defaultName: string;
  count: number;
  onSubmit: (name: string, format: "zip" | "targz") => void;
  onCancel: () => void;
}

export function CompressModal({ defaultName, count, onSubmit, onCancel }: Props) {
  const [format, setFormat] = useState<"zip" | "targz">("zip");
  const ext = format === "zip" ? ".zip" : ".tar.gz";
  const [name, setName] = useState(defaultName);

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed) onSubmit(trimmed.endsWith(ext) ? trimmed : trimmed + ext, format);
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
        <div className="flex gap-2 mb-4">
          {(["zip", "targz"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`flex-1 px-3 py-1.5 rounded text-sm transition-colors ${
                format === f
                  ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
                  : "bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {f === "zip" ? "ZIP" : "TAR.GZ"}
            </button>
          ))}
        </div>
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
