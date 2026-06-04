// Panneau de partage LAN (F22) : URL + QR code + copie + arrêt. Le serveur tourne tant que le panneau est ouvert.
import { useEffect, useState } from "react";
import { shareStart, shareStop, type ShareInfo } from "../services/share";

interface Props {
  paths: string[];
  onClose: () => void;
  onError: (msg: string) => void;
}

export function SharePanel({ paths, onClose, onError }: Props): React.ReactElement {
  const [info, setInfo] = useState<ShareInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    shareStart(paths)
      .then((i) => { if (alive) setInfo(i); else shareStop().catch(() => {}); })
      .catch((e) => onError(String(e)));
    return () => { alive = false; shareStop().catch(() => {}); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = (): void => {
    if (!info) return;
    navigator.clipboard.writeText(info.url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(380px,92vw)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 flex flex-col items-center gap-4"
      >
        <div className="text-center">
          <h2 className="text-sm font-medium text-[var(--color-text)]">Partage sur le réseau local</h2>
          <p className="mt-1 text-[11px] text-[var(--color-text-dim)]">
            {paths.length === 1 ? "1 élément" : `${paths.length} éléments`} · scanne le QR ou ouvre l'URL
          </p>
        </div>

        {!info ? (
          <div className="py-10 text-xs text-[var(--color-text-dim)]">Démarrage du serveur…</div>
        ) : (
          <>
            <div
              className="bg-white p-2 rounded-lg [&_svg]:block [&_svg]:w-48 [&_svg]:h-48"
              dangerouslySetInnerHTML={{ __html: info.qr_svg }}
            />
            <button
              onClick={copy}
              className="w-full px-3 py-2 rounded-md bg-[var(--color-bg)] border border-[var(--color-border)] text-xs font-mono text-[var(--color-text)] hover:border-[var(--color-accent)] break-all"
            >
              {copied ? "✓ Copié" : info.url}
            </button>
            <p className="text-[10px] text-[var(--color-text-dim)] text-center">
              Visible uniquement sur ton réseau local. Le partage s'arrête à la fermeture.
            </p>
          </>
        )}

        <button
          onClick={onClose}
          className="w-full px-3 py-2 rounded-md bg-[var(--color-danger)] text-[var(--color-bg)] text-sm font-medium"
        >
          Arrêter le partage
        </button>
      </div>
    </div>
  );
}
