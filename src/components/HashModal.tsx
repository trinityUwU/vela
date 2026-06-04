// Modale d'empreinte : calcule md5/sha1/sha256/blake3 d'un fichier (une passe) + vérification
// d'une somme attendue (collée) qui surligne l'algorithme correspondant.
import { useEffect, useState } from "react";
import { fileHash, type Hashes } from "../services/integrity";
import { baseName } from "../services/path-util";

interface Props {
  path: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

const ALGOS: { key: keyof Hashes; label: string }[] = [
  { key: "blake3", label: "BLAKE3" },
  { key: "sha256", label: "SHA-256" },
  { key: "sha1", label: "SHA-1" },
  { key: "md5", label: "MD5" },
];

export function HashModal({ path, onClose, onError }: Props): React.ReactElement {
  const [hashes, setHashes] = useState<Hashes | null>(null);
  const [expected, setExpected] = useState("");

  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fileHash(path)
      .then((r) => { if (!cancelled) setHashes(r); })
      .catch((e) => { if (!cancelled) onError(String(e)); });
    return () => { cancelled = true; };
  }, [path, onError]);

  const want = expected.trim().toLowerCase();
  const matched = want && hashes ? ALGOS.find((a) => hashes[a.key].toLowerCase() === want)?.key : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(640px,92vw)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2 px-5 h-12 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-medium text-[var(--color-text)] flex-1 truncate">Empreinte — {baseName(path)}</h2>
          <button onClick={onClose} className="px-2 py-1 text-xs rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Fermer</button>
        </div>

        <div className="p-4 flex flex-col gap-2">
          {!hashes && <div className="text-xs text-[var(--color-text-dim)] py-3">Calcul en cours…</div>}
          {hashes && ALGOS.map((a) => (
            <div key={a.key} className="flex items-center gap-2">
              <span className={`w-20 shrink-0 text-xs ${matched === a.key ? "text-[var(--color-accent)] font-semibold" : "text-[var(--color-text-dim)]"}`}>
                {a.label}
              </span>
              <code className="flex-1 truncate font-mono text-[11px] text-[var(--color-text)]" title={hashes[a.key]}>{hashes[a.key]}</code>
              {matched === a.key && <span className="shrink-0 text-[var(--color-accent)] text-xs">✓ correspond</span>}
              <button
                onClick={() => navigator.clipboard.writeText(hashes[a.key]).catch(() => {})}
                className="shrink-0 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              >
                copier
              </button>
            </div>
          ))}

          <div className="mt-2 pt-3 border-t border-[var(--color-border)] flex items-center gap-2">
            <input
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="Vérifier contre une somme attendue…"
              className="flex-1 px-2 py-1 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none font-mono"
            />
            {want && (
              <span className={`shrink-0 text-xs ${matched ? "text-[var(--color-accent)]" : "text-[var(--color-danger)]"}`}>
                {matched ? `✓ ${ALGOS.find((a) => a.key === matched)?.label}` : "✗ aucune correspondance"}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
