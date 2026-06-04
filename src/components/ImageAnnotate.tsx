// Annotation de captures (F16) : flèches, formes, texte, surligneur, numéros d'étape, crayon et FLOU.
// Le flou est destructif au rendu (vrais pixels pixellisés depuis l'image source) → réellement illisible.
// Export non-destructif vers <nom>_annotated.png. Cœur 100 % front.
import { useCallback, useEffect, useRef, useState } from "react";
import { readFileBase64, writeFileBase64 } from "../services/fs";
import { baseName, parentDir } from "../services/path-util";

type Tool = "arrow" | "rect" | "ellipse" | "line" | "pencil" | "highlight" | "text" | "step" | "blur";

interface Annot {
  tool: Tool;
  x1: number; y1: number; x2: number; y2: number;
  color: string; width: number;
  text?: string; points?: number[]; step?: number;
}

const TOOLS: { id: Tool; label: string }[] = [
  { id: "arrow", label: "Flèche" }, { id: "rect", label: "Rectangle" }, { id: "ellipse", label: "Ellipse" },
  { id: "line", label: "Ligne" }, { id: "pencil", label: "Crayon" }, { id: "highlight", label: "Surligneur" },
  { id: "text", label: "Texte" }, { id: "step", label: "N°" }, { id: "blur", label: "Flou" },
];
const COLORS = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ffffff", "#000000"];

function drawArrow(ctx: CanvasRenderingContext2D, a: Annot): void {
  const { x1, y1, x2, y2 } = a;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const h = Math.max(12, a.width * 4);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - h * Math.cos(ang - Math.PI / 6), y2 - h * Math.sin(ang - Math.PI / 6));
  ctx.lineTo(x2 - h * Math.cos(ang + Math.PI / 6), y2 - h * Math.sin(ang + Math.PI / 6));
  ctx.closePath(); ctx.fill();
}

function drawBlur(ctx: CanvasRenderingContext2D, a: Annot, img: HTMLImageElement): void {
  const x = Math.min(a.x1, a.x2), y = Math.min(a.y1, a.y2);
  const w = Math.abs(a.x2 - a.x1), h = Math.abs(a.y2 - a.y1);
  if (w < 2 || h < 2) return;
  const f = Math.max(8, Math.round(Math.max(w, h) / 12)); // facteur de pixellisation
  const tmp = document.createElement("canvas");
  tmp.width = Math.max(1, Math.round(w / f)); tmp.height = Math.max(1, Math.round(h / f));
  const tctx = tmp.getContext("2d");
  if (!tctx) return;
  tctx.drawImage(img, x, y, w, h, 0, 0, tmp.width, tmp.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, x, y, w, h);
  ctx.imageSmoothingEnabled = true;
}

function drawObject(ctx: CanvasRenderingContext2D, a: Annot, img: HTMLImageElement): void {
  ctx.save();
  ctx.strokeStyle = a.color; ctx.fillStyle = a.color; ctx.lineWidth = a.width;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  const w = a.x2 - a.x1, h = a.y2 - a.y1;
  if (a.tool === "arrow") drawArrow(ctx, a);
  else if (a.tool === "rect") ctx.strokeRect(a.x1, a.y1, w, h);
  else if (a.tool === "line") { ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke(); }
  else if (a.tool === "ellipse") {
    ctx.beginPath(); ctx.ellipse(a.x1 + w / 2, a.y1 + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, 2 * Math.PI); ctx.stroke();
  } else if (a.tool === "highlight") {
    ctx.globalAlpha = 0.35; ctx.lineWidth = a.width * 4;
    ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();
  } else if (a.tool === "pencil" && a.points) {
    ctx.beginPath(); ctx.moveTo(a.points[0], a.points[1]);
    for (let i = 2; i < a.points.length; i += 2) ctx.lineTo(a.points[i], a.points[i + 1]);
    ctx.stroke();
  } else if (a.tool === "text" && a.text) {
    ctx.font = `${Math.max(16, a.width * 8)}px sans-serif`; ctx.textBaseline = "top";
    ctx.fillText(a.text, a.x1, a.y1);
  } else if (a.tool === "step") {
    const r = Math.max(12, a.width * 6);
    ctx.beginPath(); ctx.arc(a.x1, a.y1, r, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = `bold ${r}px sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(a.step ?? 1), a.x1, a.y1);
  } else if (a.tool === "blur") drawBlur(ctx, a, img);
  ctx.restore();
}

export function ImageAnnotate({ path, onClose, onError, onSaved }: {
  path: string; onClose: () => void; onError: (m: string) => void; onSaved: (p: string) => void;
}): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [ready, setReady] = useState(false);
  const [tool, setTool] = useState<Tool>("arrow");
  const [color, setColor] = useState(COLORS[0]);
  const [width, setWidth] = useState(4);
  const objects = useRef<Annot[]>([]);
  const draft = useRef<Annot | null>(null);
  const stepCount = useRef(0);

  const repaint = useCallback(() => {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0);
    for (const o of objects.current) drawObject(ctx, o, img);
    if (draft.current) drawObject(ctx, draft.current, img);
  }, []);

  useEffect(() => {
    const ext = path.split(".").pop()?.toLowerCase() ?? "png";
    readFileBase64(path).then((b64) => {
      const img = new Image();
      img.onload = () => {
        const c = canvasRef.current;
        if (c) { c.width = img.naturalWidth; c.height = img.naturalHeight; }
        imgRef.current = img; setReady(true); repaint();
      };
      img.onerror = () => onError("Image illisible.");
      img.src = `data:image/${ext === "jpg" ? "jpeg" : ext};base64,${b64}`;
    }).catch((e) => onError(String(e)));
  }, [path, onError, repaint]);

  const undo = useCallback(() => { objects.current.pop(); repaint(); }, [repaint]);
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") { e.preventDefault(); undo(); }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [undo, onClose]);

  const toCanvas = (e: React.PointerEvent): { x: number; y: number } => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };

  const onDown = (e: React.PointerEvent): void => {
    if (!ready) return;
    const { x, y } = toCanvas(e);
    if (tool === "text") {
      const text = window.prompt("Texte de l'annotation :");
      if (text) { objects.current.push({ tool, x1: x, y1: y, x2: x, y2: y, color, width, text }); repaint(); }
      return;
    }
    if (tool === "step") {
      stepCount.current += 1;
      objects.current.push({ tool, x1: x, y1: y, x2: x, y2: y, color, width, step: stepCount.current });
      repaint();
      return;
    }
    draft.current = { tool, x1: x, y1: y, x2: x, y2: y, color, width, points: tool === "pencil" ? [x, y] : undefined };
  };
  const onMove = (e: React.PointerEvent): void => {
    if (!draft.current) return;
    const { x, y } = toCanvas(e);
    draft.current.x2 = x; draft.current.y2 = y;
    if (draft.current.tool === "pencil") draft.current.points?.push(x, y);
    repaint();
  };
  const onUp = (): void => {
    if (draft.current) { objects.current.push(draft.current); draft.current = null; repaint(); }
  };

  const save = (): void => {
    const c = canvasRef.current;
    if (!c) return;
    const b64 = c.toDataURL("image/png").split(",")[1];
    const name = baseName(path).replace(/\.[^.]+$/, "");
    const out = `${parentDir(path)}/${name}_annotated.png`;
    writeFileBase64(out, b64).then(() => onSaved(out)).catch((e) => onError(String(e)));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]">
      <div className="flex items-center gap-2 h-11 px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 flex-wrap">
        {TOOLS.map((t) => (
          <button
            key={t.id} onClick={() => setTool(t.id)}
            className={`px-2 py-1 text-xs rounded border ${tool === t.id ? "border-[var(--color-accent)] text-[var(--color-text)]" : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"}`}
          >
            {t.label}
          </button>
        ))}
        <div className="w-px h-5 bg-[var(--color-border)] mx-1" />
        {COLORS.map((c) => (
          <button key={c} onClick={() => setColor(c)} style={{ backgroundColor: c }}
            className={`w-5 h-5 rounded-full ${color === c ? "ring-2 ring-[var(--color-text)] ring-offset-1 ring-offset-[var(--color-surface)]" : ""}`} />
        ))}
        <input type="range" min={1} max={12} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-20" title="Épaisseur" />
        <div className="flex-1" />
        <button onClick={undo} className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Annuler (Ctrl+Z)</button>
        <button onClick={save} className="px-3 py-1 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium">Exporter PNG</button>
        <button onClick={onClose} className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Fermer</button>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center p-4">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
          className="max-w-full max-h-full object-contain shadow-2xl touch-none cursor-crosshair"
        />
      </div>
    </div>
  );
}
