// Éditeur image : édition accumulée (crop/rotate/flip/resize/adjust) avec preview CSS live,
// puis un seul Sauvegarder qui rejoue la séquence en un fichier (_edited). Mode HUD embarqué.
import { useEffect, useMemo, useState } from "react";
import * as fs from "../services/fs";
import { imageApplyOps } from "../services/media";
import type { ImageOp } from "../types";

interface MediaPanelProps {
  input: string;
  onError: (msg: string) => void;
  onClose: () => void;
  embedded?: boolean;
}

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  webp: "image/webp", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml",
};

const INPUT_CLS =
  "px-2 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] " +
  "text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
const GHOST_BTN_CLS =
  "flex-1 px-3 py-1.5 rounded text-sm bg-[var(--color-bg)] text-[var(--color-text)] " +
  "hover:bg-[var(--color-surface-hover)] disabled:opacity-50";

type Section = "crop" | "rotate" | "flip" | "resize" | "adjust";
type OutFmt = "original" | "png" | "jpg" | "webp";

interface PathParts { dir: string; stem: string; ext: string; }
interface CropState { x: number; y: number; w: number; h: number; }
interface SizeState { width: number; height: number; }
interface AdjState { brightness: number; contrast: number; saturation: number; }

function splitPath(input: string): PathParts {
  const slash = input.lastIndexOf("/");
  const dir = slash >= 0 ? input.slice(0, slash) : ".";
  const name = slash >= 0 ? input.slice(slash + 1) : input;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "png";
  return { dir, stem, ext };
}

function baseName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

function asFmt(v: string): OutFmt {
  return v === "png" || v === "jpg" || v === "webp" ? v : "original";
}

interface PreviewDerived { rotation: number; flipH: boolean; flipV: boolean; adj: AdjState | null; }

function derivePreview(ops: ImageOp[]): PreviewDerived {
  let rotation = 0, flipH = false, flipV = false;
  let adj: AdjState | null = null;
  for (const op of ops) {
    if (op.kind === "rotate") rotation = (rotation + op.degrees) % 360;
    else if (op.kind === "flip") { if (op.horizontal) flipH = !flipH; else flipV = !flipV; }
    else if (op.kind === "adjust") adj = { brightness: op.brightness, contrast: op.contrast, saturation: op.saturation };
  }
  return { rotation, flipH, flipV, adj };
}

function previewStyle(ops: ImageOp[]): React.CSSProperties {
  const { rotation, flipH, flipV, adj } = derivePreview(ops);
  const filter = adj
    ? `brightness(${1 + adj.brightness / 100}) contrast(${1 + adj.contrast / 50}) saturate(${adj.saturation})`
    : "none";
  return { filter, transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})` };
}

function opLabel(op: ImageOp): string {
  switch (op.kind) {
    case "crop": return `Recadrer ${op.w}×${op.h}`;
    case "rotate": return `Pivoter ${op.degrees}°`;
    case "flip": return op.horizontal ? "Retourner H" : "Retourner V";
    case "resize": return `Redim. ${op.width}×${op.height}`;
    case "adjust": return "Ajustements";
  }
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }): React.ReactElement {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--color-text-dim)]">
      {label}
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className={`w-full ${INPUT_CLS}`} />
    </label>
  );
}

function SliderRow({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}): React.ReactElement {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-[var(--color-accent)]" />
      <span className="w-12 text-right text-[var(--color-text)]">{value}</span>
    </label>
  );
}

const TABS: { id: Section; label: string }[] = [
  { id: "crop", label: "Recadrer" },
  { id: "rotate", label: "Pivoter" },
  { id: "flip", label: "Retourner" },
  { id: "resize", label: "Redimensionner" },
  { id: "adjust", label: "Ajustements" },
];

function SectionTabs({ active, onSelect }: { active: Section; onSelect: (s: Section) => void }): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {TABS.map((t) => (
        <button key={t.id} onClick={() => onSelect(t.id)}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${
            active === t.id
              ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
              : "bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"
          }`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

function AddBtn({ onClick }: { onClick: () => void }): React.ReactElement {
  return (
    <button onClick={onClick}
      className="px-3 py-1.5 rounded text-sm bg-[var(--color-surface-hover)] text-[var(--color-text)] hover:opacity-80">
      Ajouter
    </button>
  );
}

interface SectionProps { add: (op: ImageOp) => void; }

function CropFields({ add }: SectionProps): React.ReactElement {
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, w: 100, h: 100 });
  return (
    <div className="flex items-end gap-2">
      <NumField label="x" value={crop.x} onChange={(v) => setCrop({ ...crop, x: v })} />
      <NumField label="y" value={crop.y} onChange={(v) => setCrop({ ...crop, y: v })} />
      <NumField label="largeur" value={crop.w} onChange={(v) => setCrop({ ...crop, w: v })} />
      <NumField label="hauteur" value={crop.h} onChange={(v) => setCrop({ ...crop, h: v })} />
      <AddBtn onClick={() => add({ kind: "crop", ...crop })} />
    </div>
  );
}

function RotateFields({ add }: SectionProps): React.ReactElement {
  return (
    <div className="flex gap-2">
      {[90, 180, 270].map((d) => (
        <button key={d} onClick={() => add({ kind: "rotate", degrees: d })} className={GHOST_BTN_CLS}>{d}°</button>
      ))}
    </div>
  );
}

function FlipFields({ add }: SectionProps): React.ReactElement {
  return (
    <div className="flex gap-2">
      <button onClick={() => add({ kind: "flip", horizontal: true })} className={GHOST_BTN_CLS}>Horizontal</button>
      <button onClick={() => add({ kind: "flip", horizontal: false })} className={GHOST_BTN_CLS}>Vertical</button>
    </div>
  );
}

function ResizeFields({ add }: SectionProps): React.ReactElement {
  const [size, setSize] = useState<SizeState>({ width: 800, height: 600 });
  const [keepAspect, setKeepAspect] = useState(true);
  return (
    <div className="flex items-end gap-2">
      <NumField label="largeur" value={size.width} onChange={(v) => setSize({ ...size, width: v })} />
      <NumField label="hauteur" value={size.height} onChange={(v) => setSize({ ...size, height: v })} />
      <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)] pb-1.5">
        <input type="checkbox" checked={keepAspect} onChange={(e) => setKeepAspect(e.target.checked)} />
        proportions
      </label>
      <AddBtn onClick={() => add({ kind: "resize", width: size.width, height: size.height, keep_aspect: keepAspect })} />
    </div>
  );
}

function AdjustFields({ add }: SectionProps): React.ReactElement {
  const [adj, setAdj] = useState<AdjState>({ brightness: 0, contrast: 0, saturation: 1 });
  return (
    <div className="flex flex-col gap-2">
      <SliderRow label="Luminosité" value={adj.brightness} min={-100} max={100} onChange={(v) => setAdj({ ...adj, brightness: v })} />
      <SliderRow label="Contraste" value={adj.contrast} min={-50} max={50} onChange={(v) => setAdj({ ...adj, contrast: v })} />
      <SliderRow label="Saturation" value={adj.saturation} min={0} max={2} step={0.01} onChange={(v) => setAdj({ ...adj, saturation: v })} />
      <div className="flex justify-end"><AddBtn onClick={() => add({ kind: "adjust", ...adj })} /></div>
    </div>
  );
}

function SectionControls({ section, add }: SectionProps & { section: Section }): React.ReactElement {
  switch (section) {
    case "crop": return <CropFields add={add} />;
    case "rotate": return <RotateFields add={add} />;
    case "flip": return <FlipFields add={add} />;
    case "resize": return <ResizeFields add={add} />;
    case "adjust": return <AdjustFields add={add} />;
  }
}

function PendingOps({ ops, onUndo, onClear }: { ops: ImageOp[]; onUndo: () => void; onClear: () => void }): React.ReactElement {
  return (
    <div className="flex items-center flex-wrap gap-1.5 mt-3 min-h-6">
      {ops.length === 0 && <span className="text-xs text-[var(--color-text-dim)]">Aucune édition en attente.</span>}
      {ops.map((op, i) => (
        <span key={i} className="px-2 py-0.5 rounded text-[11px] bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]">
          {opLabel(op)}
        </span>
      ))}
      {ops.length > 0 && (
        <>
          <button onClick={onUndo} className="ml-1 text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">↶ annuler</button>
          <button onClick={onClear} className="text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-danger)]">tout effacer</button>
        </>
      )}
    </div>
  );
}

function useImageSrc(input: string, ext: string, onError: (msg: string) => void): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const mime = MIME[ext.toLowerCase()] ?? "image/png";
    fs.readFileBase64(input).then((b64) => setSrc(`data:${mime};base64,${b64}`)).catch((e) => onError(String(e)));
  }, [input, ext, onError]);
  return src;
}

function SaveBar({ fmt, setFmt, quality, setQuality, busy, onSave }: {
  fmt: OutFmt; setFmt: (f: OutFmt) => void; quality: number; setQuality: (q: number) => void;
  busy: boolean; onSave: () => void;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--color-border)]">
      <select value={fmt} onChange={(e) => setFmt(asFmt(e.target.value))} className={INPUT_CLS} title="Format de sortie">
        <option value="original">Format d'origine</option>
        <option value="png">PNG</option>
        <option value="jpg">JPG</option>
        <option value="webp">WEBP</option>
      </select>
      {(fmt === "jpg" || fmt === "webp") && (
        <label className="flex items-center gap-1 text-xs text-[var(--color-text-dim)]">
          Qualité
          <input type="range" min={0} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))}
            className="w-24 accent-[var(--color-accent)]" />
        </label>
      )}
      <div className="flex-1" />
      <button onClick={onSave} disabled={busy}
        className="px-4 py-1.5 rounded text-sm font-medium bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-50">
        {busy ? "Sauvegarde…" : "Sauvegarder"}
      </button>
    </div>
  );
}

function useSave(input: string, ops: ImageOp[], onError: (msg: string) => void) {
  const parts = useMemo(() => splitPath(input), [input]);
  const [fmt, setFmt] = useState<OutFmt>("original");
  const [quality, setQuality] = useState(85);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const outExt = fmt === "original" ? parts.ext : fmt;
  const out = `${parts.dir}/${parts.stem}_edited.${outExt}`;
  const save = (): void => {
    if (ops.length === 0) { onError("Aucune édition à sauvegarder."); return; }
    setBusy(true);
    const q = fmt === "jpg" || fmt === "webp" ? quality : undefined;
    imageApplyOps(input, out, ops, q)
      .then(() => setDone(baseName(out)))
      .catch((e) => onError(String(e)))
      .finally(() => setBusy(false));
  };
  return { fmt, setFmt, quality, setQuality, busy, done, save, outName: baseName(out) };
}

export function ImageToolsPanel({ input, onError, onClose, embedded = false }: MediaPanelProps): React.ReactElement {
  const parts = useMemo(() => splitPath(input), [input]);
  const src = useImageSrc(input, parts.ext, onError);
  const [section, setSection] = useState<Section>("rotate");
  const [ops, setOps] = useState<ImageOp[]>([]);
  const sv = useSave(input, ops, onError);
  const add = (op: ImageOp): void => setOps((prev) => [...prev, op]);

  useEffect(() => { setOps([]); }, [input]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const body = (
    <div className={embedded
      ? "flex flex-col p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      : "w-[40rem] max-h-[90vh] flex flex-col p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-medium text-[var(--color-text)]">Éditer l'image</h2>
          <p className="text-xs text-[var(--color-text-dim)] truncate">{baseName(input)}</p>
        </div>
        <button onClick={onClose} className="px-2 py-1 rounded text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]">✕</button>
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center mb-3 rounded bg-[var(--color-bg)] overflow-hidden">
        {src
          ? <img src={src} alt={baseName(input)} style={previewStyle(ops)} className="max-w-full max-h-[36vh] object-contain transition-transform" />
          : <span className="text-xs text-[var(--color-text-dim)]">Chargement…</span>}
      </div>
      <SectionTabs active={section} onSelect={setSection} />
      <SectionControls section={section} add={add} />
      <PendingOps ops={ops} onUndo={() => setOps((p) => p.slice(0, -1))} onClear={() => setOps([])} />
      <SaveBar fmt={sv.fmt} setFmt={sv.setFmt} quality={sv.quality} setQuality={sv.setQuality} busy={sv.busy} onSave={sv.save} />
      <p className="mt-2 text-xs text-[var(--color-text-dim)] h-4">
        {sv.done ? <span className="text-[var(--color-accent)]">✓ Sauvegardé : {sv.done}</span> : `Sortie : ${sv.outName}`}
      </p>
    </div>
  );

  if (embedded) return body;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>{body}</div>
    </div>
  );
}
