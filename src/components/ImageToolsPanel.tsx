// Panneau d'outils image : crop, rotate, flip, resize, ajustements, conversion — preview CSS live.
import { useEffect, useMemo, useState } from "react";
import * as fs from "../services/fs";
import {
  imageCrop,
  imageRotate,
  imageFlip,
  imageResize,
  imageAdjust,
  imageConvert,
} from "../services/media";

interface MediaPanelProps {
  input: string;
  onError: (msg: string) => void;
  onClose: () => void;
}

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

const INPUT_CLS =
  "w-full px-2 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] " +
  "text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
const GHOST_BTN_CLS =
  "flex-1 px-3 py-1.5 rounded text-sm bg-[var(--color-bg)] text-[var(--color-text)] " +
  "hover:bg-[var(--color-surface-hover)] disabled:opacity-50";

type Section = "crop" | "rotate" | "flip" | "resize" | "adjust" | "convert";
type ConvertFmt = "png" | "jpg" | "webp";

interface PathParts {
  dir: string;
  stem: string;
  ext: string;
}
interface CropState { x: number; y: number; w: number; h: number; }
interface SizeState { width: number; height: number; }
interface AdjState { brightness: number; contrast: number; saturation: number; }

function asFmt(v: string): ConvertFmt {
  return v === "jpg" || v === "webp" ? v : "png";
}

function splitPath(input: string): PathParts {
  const slash = input.lastIndexOf("/");
  const dir = slash >= 0 ? input.slice(0, slash) : ".";
  const name = slash >= 0 ? input.slice(slash + 1) : input;
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "png";
  return { dir, stem, ext };
}

function outPath(p: PathParts, suffix: string, ext: string): string {
  return `${p.dir}/${p.stem}_${suffix}.${ext}`;
}

function baseName(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash >= 0 ? path.slice(slash + 1) : path;
}

function buildFilter(adj: AdjState): string {
  return `brightness(${1 + adj.brightness / 100}) contrast(${1 + adj.contrast / 50}) saturate(${adj.saturation})`;
}

interface NumFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
}

function NumField({ label, value, onChange }: NumFieldProps): React.ReactElement {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--color-text-dim)]">
      {label}
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} className={INPUT_CLS} />
    </label>
  );
}

function ApplyBtn({ onClick, busy }: { onClick: () => void; busy: boolean }): React.ReactElement {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-50"
    >
      {busy ? "…" : "Appliquer"}
    </button>
  );
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}

function SliderRow({ label, value, min, max, step = 1, onChange }: SliderRowProps): React.ReactElement {
  return (
    <label className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--color-accent)]"
      />
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
  { id: "convert", label: "Convertir" },
];

function SectionTabs({ active, onSelect }: { active: Section; onSelect: (s: Section) => void }): React.ReactElement {
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`px-2.5 py-1 rounded text-xs transition-colors ${
            active === t.id
              ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
              : "bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

interface CropProps {
  crop: CropState;
  setCrop: (c: CropState) => void;
  onApply: () => void;
  busy: boolean;
}

function CropControls({ crop, setCrop, onApply, busy }: CropProps): React.ReactElement {
  return (
    <div className="flex items-end gap-2">
      <NumField label="x" value={crop.x} onChange={(v) => setCrop({ ...crop, x: v })} />
      <NumField label="y" value={crop.y} onChange={(v) => setCrop({ ...crop, y: v })} />
      <NumField label="largeur" value={crop.w} onChange={(v) => setCrop({ ...crop, w: v })} />
      <NumField label="hauteur" value={crop.h} onChange={(v) => setCrop({ ...crop, h: v })} />
      <ApplyBtn onClick={onApply} busy={busy} />
    </div>
  );
}

function RotateControls({ onApply, busy }: { onApply: (d: number) => void; busy: boolean }): React.ReactElement {
  return (
    <div className="flex gap-2">
      {[90, 180, 270].map((d) => (
        <button key={d} onClick={() => onApply(d)} disabled={busy} className={GHOST_BTN_CLS}>
          {d}°
        </button>
      ))}
    </div>
  );
}

function FlipControls({ onApply, busy }: { onApply: (h: boolean) => void; busy: boolean }): React.ReactElement {
  return (
    <div className="flex gap-2">
      <button onClick={() => onApply(true)} disabled={busy} className={GHOST_BTN_CLS}>Horizontal</button>
      <button onClick={() => onApply(false)} disabled={busy} className={GHOST_BTN_CLS}>Vertical</button>
    </div>
  );
}

interface ResizeProps {
  size: SizeState;
  setSize: (s: SizeState) => void;
  keepAspect: boolean;
  setKeepAspect: (v: boolean) => void;
  onApply: () => void;
  busy: boolean;
}

function ResizeControls(p: ResizeProps): React.ReactElement {
  return (
    <div className="flex items-end gap-2">
      <NumField label="largeur" value={p.size.width} onChange={(v) => p.setSize({ ...p.size, width: v })} />
      <NumField label="hauteur" value={p.size.height} onChange={(v) => p.setSize({ ...p.size, height: v })} />
      <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-dim)] pb-1.5">
        <input type="checkbox" checked={p.keepAspect} onChange={(e) => p.setKeepAspect(e.target.checked)} />
        proportions
      </label>
      <ApplyBtn onClick={p.onApply} busy={p.busy} />
    </div>
  );
}

interface AdjustProps {
  adj: AdjState;
  setAdj: (a: AdjState) => void;
  onApply: () => void;
  busy: boolean;
}

function AdjustControls({ adj, setAdj, onApply, busy }: AdjustProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <SliderRow label="Luminosité" value={adj.brightness} min={-100} max={100}
        onChange={(v) => setAdj({ ...adj, brightness: v })} />
      <SliderRow label="Contraste" value={adj.contrast} min={-50} max={50}
        onChange={(v) => setAdj({ ...adj, contrast: v })} />
      <SliderRow label="Saturation" value={adj.saturation} min={0} max={2} step={0.01}
        onChange={(v) => setAdj({ ...adj, saturation: v })} />
      <div className="flex justify-end"><ApplyBtn onClick={onApply} busy={busy} /></div>
    </div>
  );
}

interface ConvertProps {
  fmt: ConvertFmt;
  setFmt: (f: ConvertFmt) => void;
  quality: number;
  setQuality: (q: number) => void;
  onApply: () => void;
  busy: boolean;
}

function ConvertControls(p: ConvertProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select value={p.fmt} onChange={(e) => p.setFmt(asFmt(e.target.value))} className={INPUT_CLS}>
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="webp">WEBP</option>
        </select>
        <ApplyBtn onClick={p.onApply} busy={p.busy} />
      </div>
      {p.fmt !== "png" && (
        <SliderRow label="Qualité" value={p.quality} min={0} max={100} onChange={p.setQuality} />
      )}
    </div>
  );
}

interface OpRunner {
  parts: PathParts;
  busy: boolean;
  run: (op: () => Promise<void>, out: string) => void;
}

function useOpRunner(input: string, onError: (msg: string) => void, onDone: (name: string) => void): OpRunner {
  const parts = useMemo(() => splitPath(input), [input]);
  const [busy, setBusy] = useState(false);
  const run = (op: () => Promise<void>, out: string): void => {
    setBusy(true);
    op()
      .then(() => onDone(baseName(out)))
      .catch((e) => onError(String(e)))
      .finally(() => setBusy(false));
  };
  return { parts, busy, run };
}

interface PreviewProps {
  src: string | null;
  alt: string;
  style: React.CSSProperties;
}

function PreviewArea({ src, alt, style }: PreviewProps): React.ReactElement {
  return (
    <div
      className={
        "flex-1 min-h-0 flex items-center justify-center mb-3 rounded " +
        "bg-[var(--color-bg)] overflow-hidden"
      }
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          style={style}
          className="max-w-full max-h-[40vh] object-contain transition-transform"
        />
      ) : (
        <span className="text-xs text-[var(--color-text-dim)]">Chargement…</span>
      )}
    </div>
  );
}

function ModalHeader({ name, onClose }: { name: string; onClose: () => void }): React.ReactElement {
  return (
    <div className="flex items-center justify-between mb-3">
      <div>
        <h2 className="text-sm font-medium text-[var(--color-text)]">Outils image</h2>
        <p className="text-xs text-[var(--color-text-dim)] truncate">{name}</p>
      </div>
      <button
        onClick={onClose}
        className="px-2 py-1 rounded text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"
      >
        ✕
      </button>
    </div>
  );
}

interface ImageState extends Ops {
  src: string | null;
  section: Section;
  selectSection: (s: Section) => void;
  done: string | null;
  busy: boolean;
  previewStyle: React.CSSProperties;
  outName: string;
  crop: CropState;
  setCrop: (c: CropState) => void;
  size: SizeState;
  setSize: (s: SizeState) => void;
  keepAspect: boolean;
  setKeepAspect: (v: boolean) => void;
  adj: AdjState;
  setAdj: (a: AdjState) => void;
  fmt: ConvertFmt;
  setFmt: (f: ConvertFmt) => void;
  quality: number;
  setQuality: (q: number) => void;
}

interface Ops {
  onCrop: () => void;
  onRotate: (deg: number) => void;
  onFlip: (h: boolean) => void;
  onResize: () => void;
  onAdjust: () => void;
  onConvert: () => void;
}

interface OpsCtx {
  input: string;
  runner: OpRunner;
  crop: CropState;
  size: SizeState;
  keepAspect: boolean;
  adj: AdjState;
  fmt: ConvertFmt;
  quality: number;
  setRotation: (v: number) => void;
  setFlipH: (fn: (v: boolean) => boolean) => void;
  setFlipV: (fn: (v: boolean) => boolean) => void;
}

function buildOps(c: OpsCtx): Ops {
  const { input, crop, size, keepAspect, adj, fmt, quality } = c;
  const { parts, run } = c.runner;
  return {
    onCrop: () => run(() => imageCrop(input, outPath(parts, "crop", parts.ext),
      crop.x, crop.y, crop.w, crop.h), outPath(parts, "crop", parts.ext)),
    onRotate: (deg) => {
      c.setRotation(deg);
      run(() => imageRotate(input, outPath(parts, "rotated", parts.ext), deg), outPath(parts, "rotated", parts.ext));
    },
    onFlip: (h) => {
      if (h) c.setFlipH((v) => !v); else c.setFlipV((v) => !v);
      run(() => imageFlip(input, outPath(parts, "flip", parts.ext), h), outPath(parts, "flip", parts.ext));
    },
    onResize: () => run(() => imageResize(input, outPath(parts, "resized", parts.ext),
      size.width, size.height, keepAspect), outPath(parts, "resized", parts.ext)),
    onAdjust: () => run(() => imageAdjust(input, outPath(parts, "adjusted", parts.ext),
      adj.brightness, adj.contrast, adj.saturation), outPath(parts, "adjusted", parts.ext)),
    onConvert: () => run(() => imageConvert(input, outPath(parts, "converted", fmt),
      fmt === "png" ? undefined : quality), outPath(parts, "converted", fmt)),
  };
}

function useImageSrc(input: string, ext: string, onError: (msg: string) => void): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    const mime = MIME[ext.toLowerCase()] ?? "image/png";
    fs.readFileBase64(input)
      .then((b64) => setSrc(`data:${mime};base64,${b64}`))
      .catch((e) => onError(String(e)));
  }, [input, ext, onError]);
  return src;
}

function useImageState(input: string, onError: (msg: string) => void): ImageState {
  const [section, setSection] = useState<Section>("crop");
  const [done, setDone] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, w: 100, h: 100 });
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [size, setSize] = useState<SizeState>({ width: 800, height: 600 });
  const [keepAspect, setKeepAspect] = useState(true);
  const [adj, setAdj] = useState<AdjState>({ brightness: 0, contrast: 0, saturation: 1 });
  const [fmt, setFmt] = useState<ConvertFmt>("png");
  const [quality, setQuality] = useState(85);
  const runner = useOpRunner(input, onError, setDone);
  const { parts, busy } = runner;
  const src = useImageSrc(input, parts.ext, onError);
  const previewStyle = useMemo<React.CSSProperties>(() => ({
    filter: section === "adjust" ? buildFilter(adj) : "none",
    transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`,
  }), [section, adj, flipH, flipV, rotation]);
  const ops = buildOps({
    input, runner, crop, size, keepAspect, adj, fmt, quality, setRotation, setFlipH, setFlipV,
  });
  const selectSection = (s: Section): void => { setSection(s); setDone(null); };
  const outName = baseName(outPath(parts, "…", section === "convert" ? fmt : parts.ext));
  return {
    src, section, selectSection, done, busy, previewStyle, outName, crop, setCrop, size, setSize,
    keepAspect, setKeepAspect, adj, setAdj, fmt, setFmt, quality, setQuality, ...ops,
  };
}

function SectionControls({ s }: { s: ImageState }): React.ReactElement | null {
  switch (s.section) {
    case "crop":
      return <CropControls crop={s.crop} setCrop={s.setCrop} onApply={s.onCrop} busy={s.busy} />;
    case "rotate":
      return <RotateControls onApply={s.onRotate} busy={s.busy} />;
    case "flip":
      return <FlipControls onApply={s.onFlip} busy={s.busy} />;
    case "resize":
      return (
        <ResizeControls size={s.size} setSize={s.setSize} keepAspect={s.keepAspect}
          setKeepAspect={s.setKeepAspect} onApply={s.onResize} busy={s.busy} />
      );
    case "adjust":
      return <AdjustControls adj={s.adj} setAdj={s.setAdj} onApply={s.onAdjust} busy={s.busy} />;
    case "convert":
      return (
        <ConvertControls fmt={s.fmt} setFmt={s.setFmt} quality={s.quality}
          setQuality={s.setQuality} onApply={s.onConvert} busy={s.busy} />
      );
    default:
      return null;
  }
}

export function ImageToolsPanel({ input, onError, onClose }: MediaPanelProps): React.ReactElement {
  const s = useImageState(input, onError);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className={
          "w-[40rem] max-h-[90vh] flex flex-col p-4 rounded-lg border border-[var(--color-border)] " +
          "bg-[var(--color-surface)] shadow-2xl"
        }
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader name={baseName(input)} onClose={onClose} />
        <PreviewArea src={s.src} alt={baseName(input)} style={s.previewStyle} />
        <SectionTabs active={s.section} onSelect={s.selectSection} />
        <SectionControls s={s} />
        <p className="mt-3 text-xs text-[var(--color-text-dim)] h-4">
          {s.done ? (
            <span className="text-[var(--color-accent)]">✓ Exporté : {s.done}</span>
          ) : (
            `Sortie : ${s.outName}`
          )}
        </p>
      </div>
    </div>
  );
}
