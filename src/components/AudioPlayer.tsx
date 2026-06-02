// Lecteur audio stylisé : lecture native GStreamer (player.rs) — seek par horloge pipeline,
// zéro coupure. Visualizer = vrai spectre fréquentiel poussé par l'élément GStreamer `spectrum`.
import { useEffect, useRef, useState, type ReactElement } from "react";
import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { playerOpenAudio, playerPause, playerResume, playerSeek, playerSetVolume, playerPosition, playerClose } from "../services/fs";
import { Play, Pause, Volume, VolumeMute } from "./icons";
import { VIZ_MODES, drawBars, drawWave, drawRadial, shiftLeft, drawSpectroColumn, type VizMode } from "./audio-viz";
import type { DirEntry } from "../types";

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function accentColor(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim();
  return v || "#6366f1";
}

// Boucle rAF unique pilotant le rendu selon le mode courant (ref → pas de relance).
// Modes continus (bars/wave/radial) lissés à 60fps ; spectro peint une colonne par frame reçue.
function useSpectrum(canvasRef: React.RefObject<HTMLCanvasElement | null>, modeRef: React.RefObject<VizMode>): (bands: Uint8Array) => void {
  const targetRef = useRef<Float32Array | null>(null);
  const smoothRef = useRef<Float32Array | null>(null);
  const seqRef = useRef(0);
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const resize = (): void => {
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.round(r.width));
      cv.height = Math.max(1, Math.round(r.height));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(cv);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    let raf = 0;
    let lastSeq = -1;
    const draw = (): void => {
      raf = requestAnimationFrame(draw);
      const cv = canvasRef.current;
      const ctx = cv?.getContext("2d");
      const target = targetRef.current;
      const smooth = smoothRef.current;
      if (!cv || !ctx || !target || !smooth) return;
      const { width: w, height: h } = cv;
      const col = accentColor();
      const mode = modeRef.current;
      if (mode === "spectro") {
        if (seqRef.current !== lastSeq) { lastSeq = seqRef.current; shiftLeft(ctx, cv); drawSpectroColumn(ctx, w, h, target); }
        return;
      }
      for (let i = 0; i < smooth.length; i++) smooth[i] += (target[i] - smooth[i]) * 0.35;
      ctx.clearRect(0, 0, w, h);
      if (mode === "wave") drawWave(ctx, w, h, smooth, col);
      else if (mode === "radial") drawRadial(ctx, w, h, smooth, col);
      else drawBars(ctx, w, h, smooth, col);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);
  return (bands: Uint8Array): void => {
    if (!targetRef.current || targetRef.current.length !== bands.length) {
      targetRef.current = new Float32Array(bands.length);
      smoothRef.current = new Float32Array(bands.length);
    }
    const t = targetRef.current;
    for (let i = 0; i < bands.length; i++) t[i] = bands[i] / 255;
    seqRef.current++;
  };
}

export function AudioPlayer({ entry }: { entry: DirEntry }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const draggingRef = useRef(false);
  const idRef = useRef<string>("");
  const [playing, setPlaying] = useState(true);
  const [ended, setEnded] = useState(false);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [mode, setMode] = useState<VizMode>(() => (localStorage.getItem("vela-audioviz") as VizMode) || "bars");
  const modeRef = useRef<VizMode>(mode);
  modeRef.current = mode;

  const pushSpectrum = useSpectrum(canvasRef, modeRef);

  // Reset du canvas au changement de mode (le spectro accumule, les autres non).
  useEffect(() => {
    localStorage.setItem("vela-audioviz", mode);
    const cv = canvasRef.current;
    cv?.getContext("2d")?.clearRect(0, 0, cv.width, cv.height);
  }, [mode]);

  useEffect(() => {
    const id = `audio-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    idRef.current = id;
    let alive = true;

    const channel = new Channel<ArrayBuffer>();
    channel.onmessage = (buf) => { if (alive) pushSpectrum(new Uint8Array(buf)); };

    const unlistenP = listen<string>("player-ended", ({ payload }) => {
      if (payload === id && alive) { setEnded(true); setPlaying(false); }
    });

    playerOpenAudio(id, entry.path, channel)
      .then((info) => { if (alive) setDuration(info.duration); })
      .catch((e) => { if (alive) setError(String(e)); });

    // Position depuis l'horloge pipeline (pas de frames côté audio).
    const poll = setInterval(async () => {
      if (!alive || draggingRef.current) return;
      try {
        const pos = await playerPosition(id);
        if (seekRef.current) seekRef.current.value = String(pos);
        if (timeRef.current) timeRef.current.textContent = fmtTime(pos);
      } catch { /* ignore */ }
    }, 250);

    return () => {
      alive = false;
      clearInterval(poll);
      playerClose(id).catch(() => {});
      unlistenP.then((u) => u());
    };
  }, [entry.path]);

  const toggle = (): void => {
    const id = idRef.current;
    if (!id) return;
    if (ended) { playerSeek(id, 0).then(() => playerResume(id)).catch(() => {}); setEnded(false); setPlaying(true); return; }
    if (playing) { playerPause(id).catch(() => {}); setPlaying(false); }
    else { playerResume(id).catch(() => {}); setPlaying(true); }
  };
  const onSeek = (v: number): void => {
    const id = idRef.current;
    if (id) playerSeek(id, v).catch(() => {});
    if (ended) { setEnded(false); setPlaying(true); }
  };
  const applyVolume = (v: number, isMuted: boolean): void => {
    const id = idRef.current;
    if (id) playerSetVolume(id, isMuted ? 0 : v).catch(() => {});
  };
  const onVolume = (v: number): void => { setVolume(v); setMuted(v === 0); applyVolume(v, v === 0); };
  const toggleMute = (): void => { const m = !muted; setMuted(m); applyVolume(volume, m); };

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)] bg-[var(--color-bg)]">{error}</div>;
  }

  return (
    <div className="relative flex-1 min-h-0 overflow-hidden bg-[var(--color-bg)]">
      {/* Visualizer plein conteneur */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Vinyle centré, pièce maîtresse */}
      <div className="absolute inset-0 grid place-items-center pointer-events-none">
        <div
          className="w-48 h-48 rounded-full grid place-items-center shadow-2xl"
          style={{
            background: "radial-gradient(circle at 50% 50%, #1a1a1a 30%, #000 31%, #111 33%, #000 35%, #0d0d0d 60%, #000 62%, #111 100%)",
            animation: playing && !ended ? "spin 8s linear infinite" : "none",
          }}
        >
          <div className="w-16 h-16 rounded-full grid place-items-center bg-[var(--color-accent)] text-[var(--color-bg)] shadow-inner">
            <span className="text-2xl leading-none">♪</span>
          </div>
        </div>
      </div>

      {/* Sélecteur de mode, haut */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2">
        <div className="flex rounded-md bg-black/40 backdrop-blur p-0.5 border border-white/10">
          {VIZ_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`px-3 py-1 text-[11px] rounded transition-colors ${
                mode === m.key ? "bg-[var(--color-accent)] text-[var(--color-bg)] font-medium" : "text-white/60 hover:text-white"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Transport, overlay bas sur dégradé */}
      <div className="absolute bottom-0 inset-x-0 flex flex-col gap-2 px-6 pt-10 pb-5 bg-gradient-to-t from-black/85 via-black/55 to-transparent">
        <div className="text-sm text-white truncate text-center">{entry.name}</div>
        <div className="w-full flex items-center gap-3">
          <button onClick={toggle} className="shrink-0 w-11 h-11 rounded-full grid place-items-center bg-[var(--color-accent)] text-[var(--color-bg)] hover:brightness-110 transition" title={playing ? "Pause" : "Lecture"}>
            {playing && !ended ? <Pause width={20} height={20} /> : <Play width={20} height={20} />}
          </button>
          <span ref={timeRef} className="text-[11px] tabular-nums text-white/70 w-10">0:00</span>
          <input
            ref={seekRef}
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            defaultValue={0}
            onMouseDown={() => { draggingRef.current = true; }}
            onMouseUp={(e) => { draggingRef.current = false; onSeek(parseFloat((e.target as HTMLInputElement).value)); }}
            onChange={(e) => { if (timeRef.current) timeRef.current.textContent = fmtTime(parseFloat(e.target.value)); }}
            className="flex-1 accent-[var(--color-accent)] h-1"
          />
          <span className="text-[11px] tabular-nums text-white/70 w-10 text-right">{fmtTime(duration)}</span>
          <button onClick={toggleMute} className="shrink-0 text-white hover:text-[var(--color-accent)]" title={muted ? "Réactiver le son" : "Couper le son"}>
            {muted || volume === 0 ? <VolumeMute width={17} height={17} /> : <Volume width={17} height={17} />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => onVolume(parseFloat(e.target.value))}
            className="w-16 accent-[var(--color-accent)] h-1 shrink-0"
            title="Volume"
          />
        </div>
      </div>
    </div>
  );
}
