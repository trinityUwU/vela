// Boîte à outils PDF (F12) : 1 PDF → extraire des pages / pivoter ; plusieurs → fusionner (réordonnable).
// Non-destructif : chaque action produit un nouveau fichier (_pages, _rotated, _merged).
import { useState } from "react";
import { pdfMerge, pdfExtractPages, pdfRotate } from "../services/pdf";
import { baseName } from "../services/path-util";

interface Props {
  paths: string[];
  onDone: (resultPath: string) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function PdfTools({ paths, onDone, onClose, onError }: Props): React.ReactElement {
  const multi = paths.length > 1;
  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(460px,92vw)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 flex flex-col gap-4"
      >
        <h2 className="text-sm font-medium text-[var(--color-text)]">Outils PDF</h2>
        {multi
          ? <MergeForm paths={paths} onDone={onDone} onError={onError} />
          : <SingleForm path={paths[0]} onDone={onDone} onError={onError} />}
        <div className="flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function SingleForm({ path, onDone, onError }: { path: string; onDone: (p: string) => void; onError: (m: string) => void }): React.ReactElement {
  const [ranges, setRanges] = useState("");
  const run = (fn: Promise<string>): void => { fn.then(onDone).catch((e) => onError(String(e))); };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[var(--color-text-dim)] truncate">{baseName(path)}</p>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-[var(--color-text)]">Extraire des pages</label>
        <div className="flex gap-2">
          <input
            value={ranges} onChange={(e) => setRanges(e.target.value)}
            placeholder="1-3,7,10-" spellCheck={false}
            className="flex-1 h-8 px-2 text-xs font-mono rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
          <button
            onClick={() => ranges.trim() && run(pdfExtractPages(path, ranges))}
            className="px-3 h-8 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
          >
            Extraire
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-[var(--color-text)]">Pivoter</label>
        <div className="flex gap-2">
          {[90, 180, 270].map((d) => (
            <button
              key={d} onClick={() => run(pdfRotate(path, d))}
              className="flex-1 h-8 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-text-dim)]"
            >
              {d}°
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MergeForm({ paths, onDone, onError }: { paths: string[]; onDone: (p: string) => void; onError: (m: string) => void }): React.ReactElement {
  const [order, setOrder] = useState(paths);
  const move = (i: number, dir: -1 | 1): void => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-[var(--color-text-dim)]">Fusionner {order.length} PDF (réordonne si besoin) :</p>
      <div className="flex flex-col gap-1 max-h-60 overflow-auto">
        {order.map((p, i) => (
          <div key={p} className="flex items-center gap-2 px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)]">
            <span className="text-[11px] text-[var(--color-text-dim)] w-5">{i + 1}.</span>
            <span className="flex-1 text-xs text-[var(--color-text)] truncate">{baseName(p)}</span>
            <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)] disabled:opacity-30">↑</button>
            <button onClick={() => move(i, 1)} disabled={i === order.length - 1} className="px-1 text-[var(--color-text-dim)] hover:text-[var(--color-text)] disabled:opacity-30">↓</button>
          </div>
        ))}
      </div>
      <button
        onClick={() => pdfMerge(order, "").then(onDone).catch((e) => onError(String(e)))}
        className="px-3 h-8 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
      >
        Fusionner
      </button>
    </div>
  );
}
