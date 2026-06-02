// Renderers canvas pour le visualizer audio : consomment les mêmes 64 bandes (0-1)
// poussées par player.rs. Modes commutables en direct durant la lecture.

export type VizMode = "bars" | "wave" | "radial" | "spectro";

export const VIZ_MODES: { key: VizMode; label: string }[] = [
  { key: "bars", label: "Barres" },
  { key: "wave", label: "Ondes" },
  { key: "radial", label: "Radial" },
  { key: "spectro", label: "Chaleur" },
];

function hexA(hex: string, a: number): string {
  const m = hex.replace("#", "");
  if (m.length < 6) return `rgba(99,102,241,${a})`;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

const HEAT: number[][] = [[10, 10, 22], [55, 14, 95], [150, 25, 90], [232, 90, 30], [255, 212, 84]];
function heat(v: number): string {
  v = Math.max(0, Math.min(1, v));
  const seg = v * (HEAT.length - 1);
  const i = Math.floor(seg);
  const f = seg - i;
  const a = HEAT[i];
  const b = HEAT[Math.min(i + 1, HEAT.length - 1)];
  const r = a[0] + (b[0] - a[0]) * f;
  const g = a[1] + (b[1] - a[1]) * f;
  const bl = a[2] + (b[2] - a[2]) * f;
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}

export function drawBars(ctx: CanvasRenderingContext2D, w: number, h: number, s: Float32Array, color: string): void {
  const n = s.length;
  const gap = Math.max(2, w * 0.004);
  const barW = (w - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const v = s[i];
    const bh = Math.max(2, v * h * 0.9);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.4 + v * 0.6;
    ctx.fillRect(i * (barW + gap), h - bh, barW, bh);
  }
  ctx.globalAlpha = 1;
}

export function drawWave(ctx: CanvasRenderingContext2D, w: number, h: number, s: Float32Array, color: string): void {
  const n = s.length;
  const pt = (i: number): [number, number] => [(i / (n - 1)) * w, h - Math.max(2, s[i] * (h - 4)) ];
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let i = 0; i < n; i++) ctx.lineTo(...pt(i));
  ctx.lineTo(w, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, hexA(color, 0.6));
  grad.addColorStop(1, hexA(color, 0.04));
  ctx.fillStyle = grad;
  ctx.globalAlpha = 1;
  ctx.fill();
  ctx.beginPath();
  for (let i = 0; i < n; i++) ctx.lineTo(...pt(i));
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawRadial(ctx: CanvasRenderingContext2D, w: number, h: number, s: Float32Array, color: string): void {
  const cx = w / 2;
  const cy = h / 2;
  const r0 = Math.min(w, h) * 0.16;
  const r1 = Math.min(w, h) * 0.48;
  const n = s.length;
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    const len = r0 + s[i] * (r1 - r0);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.4 + s[i] * 0.6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
    ctx.lineTo(cx + Math.cos(ang) * len, cy + Math.sin(ang) * len);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// Spectro : décale l'image d'1px vers la gauche puis peint la colonne courante à droite.
export function shiftLeft(ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement): void {
  ctx.globalAlpha = 1;
  ctx.drawImage(cv, -1, 0);
}
export function drawSpectroColumn(ctx: CanvasRenderingContext2D, w: number, h: number, bands: Float32Array): void {
  ctx.globalAlpha = 1;
  const n = bands.length;
  for (let y = 0; y < h; y++) {
    const band = Math.floor((1 - y / h) * (n - 1));
    ctx.fillStyle = heat(bands[band]);
    ctx.fillRect(w - 1, y, 1, 1);
  }
}
