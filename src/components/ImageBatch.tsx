// Traitement d'images par lot (F15) : redimensionner / convertir / strip EXIF / renommer.
// Sortie dans un sous-dossier (jamais d'écrasement). Progression en direct via image-batch-progress.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { imagesBatch, type BatchOptions, type BatchProgress } from "../services/imaging";

interface Props {
  paths: string[];
  onDone: (outDir: string) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}

const FORMATS = ["(garder)", "png", "jpg", "webp"];

export function ImageBatch({ paths, onDone, onClose, onError }: Props): React.ReactElement {
  const [maxDim, setMaxDim] = useState("1920");
  const [resize, setResize] = useState(true);
  const [format, setFormat] = useState("(garder)");
  const [quality, setQuality] = useState(80);
  const [stripExif, setStripExif] = useState(true);
  const [rename, setRename] = useState("");
  const [progress, setProgress] = useState<BatchProgress | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    const un = listen<BatchProgress>("image-batch-progress", ({ payload }) => setProgress(payload));
    return () => { un.then((u) => u()); };
  }, []);

  const run = (): void => {
    const dim = resize ? parseInt(maxDim, 10) : NaN;
    const options: BatchOptions = {
      maxWidth: resize && !Number.isNaN(dim) ? dim : null,
      maxHeight: resize && !Number.isNaN(dim) ? dim : null,
      format: format === "(garder)" ? null : format,
      quality: (format === "jpg" || format === "webp") ? quality : null,
      stripExif,
      renamePattern: rename.trim() || null,
      outSubdir: "optimized",
    };
    setRunning(true);
    imagesBatch(paths, options)
      .then(onDone)
      .catch((e) => { onError(String(e)); setRunning(false); });
  };

  const pct = progress ? Math.round((progress.done / progress.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60" onClick={running ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[min(440px,92vw)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 flex flex-col gap-4">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text)]">Traiter {paths.length} image{paths.length > 1 ? "s" : ""} par lot</h2>
          <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">Sortie dans un sous-dossier « optimized » — les originaux ne sont jamais modifiés.</p>
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
          <input type="checkbox" checked={resize} onChange={(e) => setResize(e.target.checked)} />
          Redimensionner (côté max, px)
          <input value={maxDim} onChange={(e) => setMaxDim(e.target.value)} disabled={!resize}
            className="w-20 h-7 px-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none disabled:opacity-40" />
        </label>

        <div className="flex items-center gap-2 text-xs text-[var(--color-text)]">
          <span>Format</span>
          <select value={format} onChange={(e) => setFormat(e.target.value)}
            className="h-7 px-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none">
            {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          {(format === "jpg" || format === "webp") && (
            <>
              <span className="ml-2">Qualité {quality}</span>
              <input type="range" min={10} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="flex-1" />
            </>
          )}
        </div>

        <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
          <input type="checkbox" checked={stripExif} onChange={(e) => setStripExif(e.target.checked)} />
          Retirer les métadonnées (EXIF/GPS)
        </label>

        <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
          Renommer
          <input value={rename} onChange={(e) => setRename(e.target.value)} placeholder="photo_### (optionnel)"
            className="flex-1 h-7 px-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none font-mono" />
        </label>

        {running && progress && (
          <div>
            <div className="h-1.5 rounded bg-[var(--color-bg)] overflow-hidden">
              <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[11px] text-[var(--color-text-dim)] mt-1">{progress.done}/{progress.total}</p>
          </div>
        )}

        <div className="flex justify-end gap-2">
          {!running && <button onClick={onClose} className="px-3 py-1.5 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Annuler</button>}
          <button onClick={run} disabled={running} className="px-3 py-1.5 text-sm rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium disabled:opacity-50">
            {running ? "Traitement…" : "Traiter"}
          </button>
        </div>
      </div>
    </div>
  );
}
