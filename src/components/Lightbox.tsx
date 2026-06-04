// Lightbox plein écran (F14) : navigation ←/→, zoom molette/±, pan, EXIF, palette de couleurs, pipette.
import { useCallback, useEffect, useState } from "react";
import { readFileBase64 } from "../services/fs";
import { imageExif, imagePalette, type ExifField } from "../services/gallery";
import { baseName } from "../services/path-util";
import type { DirEntry } from "../types";

interface Props {
  images: DirEntry[];
  index: number;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function Lightbox({ images, index, onClose, onError }: Props): React.ReactElement {
  const [i, setI] = useState(index);
  const [src, setSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [exif, setExif] = useState<ExifField[] | null>(null);
  const [palette, setPalette] = useState<string[] | null>(null);
  const [pipette, setPipette] = useState(false);
  const [info, setInfo] = useState(false);
  const cur = images[i];

  useEffect(() => {
    if (!cur) return;
    setSrc(null); setScale(1); setPan({ x: 0, y: 0 }); setExif(null); setPalette(null);
    const ext = cur.path.split(".").pop()?.toLowerCase() ?? "png";
    readFileBase64(cur.path)
      .then((b64) => setSrc(`data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64}`))
      .catch((e) => onError(String(e)));
  }, [cur, onError]);

  const go = useCallback((d: number) => setI((v) => (v + d + images.length) % images.length), [images.length]);
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "+" || e.key === "=") setScale((s) => Math.min(8, s + 0.25));
      else if (e.key === "-") setScale((s) => Math.max(0.25, s - 0.25));
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [go, onClose]);

  const loadExif = (): void => {
    setInfo((v) => !v);
    if (!exif && cur) imageExif(cur.path).then(setExif).catch(() => setExif([]));
  };
  const loadPalette = (): void => {
    if (cur) imagePalette(cur.path, 6).then(setPalette).catch((e) => onError(String(e)));
  };
  const copy = (t: string): void => { navigator.clipboard.writeText(t).catch(() => {}); };

  const onPick = (e: React.MouseEvent<HTMLImageElement>): void => {
    if (!pipette) return;
    const img = e.currentTarget;
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const r = img.getBoundingClientRect();
    const x = Math.round((e.clientX - r.left) * (img.naturalWidth / r.width));
    const y = Math.round((e.clientY - r.top) * (img.naturalHeight / r.height));
    const [rr, gg, bb] = ctx.getImageData(x, y, 1, 1).data;
    copy(`#${[rr, gg, bb].map((n) => n.toString(16).padStart(2, "0")).join("")}`);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95">
      <div className="flex items-center gap-2 h-11 px-3 shrink-0 text-xs text-white/80">
        <span className="truncate">{cur ? baseName(cur.path) : ""}</span>
        <span className="text-white/40">{i + 1}/{images.length}</span>
        <div className="flex-1" />
        <Tool label="−" on={() => setScale((s) => Math.max(0.25, s - 0.25))} />
        <span className="w-12 text-center">{Math.round(scale * 100)}%</span>
        <Tool label="+" on={() => setScale((s) => Math.min(8, s + 0.25))} />
        <Tool label="Pipette" active={pipette} on={() => setPipette((v) => !v)} />
        <Tool label="Palette" on={loadPalette} />
        <Tool label="EXIF" active={info} on={loadExif} />
        <Tool label="✕" on={onClose} />
      </div>

      <div className="flex-1 flex min-h-0">
        <button onClick={() => go(-1)} className="px-3 text-white/50 hover:text-white text-2xl shrink-0">‹</button>
        <div className="flex-1 flex items-center justify-center overflow-hidden relative">
          {src
            ? <img
                src={src} alt={cur ? baseName(cur.path) : ""}
                onClick={onPick}
                style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${scale})`, cursor: pipette ? "crosshair" : scale > 1 ? "grab" : "default" }}
                onMouseDown={(e) => {
                  if (scale <= 1 || pipette) return;
                  const start = { x: e.clientX - pan.x, y: e.clientY - pan.y };
                  const move = (ev: MouseEvent): void => setPan({ x: ev.clientX - start.x, y: ev.clientY - start.y });
                  const up = (): void => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
                  window.addEventListener("mousemove", move); window.addEventListener("mouseup", up);
                }}
                onWheel={(e) => setScale((s) => Math.max(0.25, Math.min(8, s - Math.sign(e.deltaY) * 0.15)))}
                className="max-w-full max-h-full object-contain select-none"
                draggable={false}
              />
            : <span className="text-white/40 text-sm">Chargement…</span>}
        </div>
        <button onClick={() => go(1)} className="px-3 text-white/50 hover:text-white text-2xl shrink-0">›</button>

        {(info || palette) && (
          <div className="w-64 shrink-0 overflow-auto bg-[var(--color-surface)] border-l border-[var(--color-border)] p-3 text-xs">
            {palette && (
              <div className="mb-4">
                <div className="text-[var(--color-text-dim)] mb-2">Palette</div>
                <div className="flex flex-wrap gap-1">
                  {palette.map((c) => (
                    <button key={c} onClick={() => copy(c)} title={`${c} (copier)`} style={{ backgroundColor: c }}
                      className="w-8 h-8 rounded border border-[var(--color-border)]" />
                  ))}
                </div>
              </div>
            )}
            {info && (
              <div>
                <div className="text-[var(--color-text-dim)] mb-2">EXIF</div>
                {exif === null && <div className="text-[var(--color-text-dim)]">Lecture…</div>}
                {exif?.length === 0 && <div className="text-[var(--color-text-dim)]">Aucune métadonnée.</div>}
                {exif?.map((f, k) => (
                  <div key={k} className="flex justify-between gap-2 py-0.5 border-b border-[var(--color-border)]/30">
                    <span className="text-[var(--color-text-dim)] truncate">{f.label}</span>
                    <span className="text-[var(--color-text)] truncate text-right">{f.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Tool({ label, on, active }: { label: string; on: () => void; active?: boolean }): React.ReactElement {
  return (
    <button onClick={on} className={`px-2 py-1 rounded ${active ? "bg-[var(--color-accent)] text-[var(--color-bg)]" : "text-white/70 hover:text-white hover:bg-white/10"}`}>
      {label}
    </button>
  );
}
