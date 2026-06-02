// Aperçu média inline. Vidéo : décodage natif GStreamer côté Rust (GPU), frames JPEG peintes
// sur <canvas> (contourne l'élément <video> WebKitGTK cassé sur Nvidia/Wayland) + audio joué
// par GStreamer (synchro A/V garantie par l'horloge pipeline). Audio seul : blob <audio>.
import { useEffect, useRef, useState } from "react";
import { Channel } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { readFileBase64, playerOpen, playerPause, playerResume, playerSeek, playerSetVolume, playerClose } from "../services/fs";
import { Play, Pause, Maximize, Minimize, Volume, VolumeMute } from "./icons";
import type { DirEntry } from "../types";

interface Props {
  entry: DirEntry;
  kind: "video" | "audio";
  active?: boolean;
}

export function MediaViewer({ entry, kind, active = true }: Props) {
  return kind === "video" ? <VideoPlayer entry={entry} active={active} /> : <AudioPlayer entry={entry} />;
}

function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) secs = 0;
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function VideoPlayer({ entry, active }: { entry: DirEntry; active: boolean }) {
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
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = `play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    idRef.current = id;
    let alive = true;
    let ctx: CanvasRenderingContext2D | null = null;
    setPlaying(true);
    setEnded(false);

    const channel = new Channel<ArrayBuffer>();
    channel.onmessage = async (buf) => {
      if (!alive) return;
      const pts = new DataView(buf).getFloat64(0, true);
      try {
        const bmp = await createImageBitmap(new Blob([buf.slice(8)], { type: "image/jpeg" }));
        if (!alive) { bmp.close(); return; }
        const cv = canvasRef.current;
        if (cv) {
          if (cv.width !== bmp.width || cv.height !== bmp.height) { cv.width = bmp.width; cv.height = bmp.height; }
          if (!ctx) ctx = cv.getContext("2d");
          ctx?.drawImage(bmp, 0, 0);
        }
        bmp.close();
        if (!draggingRef.current && seekRef.current) seekRef.current.value = String(pts);
        if (timeRef.current) timeRef.current.textContent = fmtTime(pts);
      } catch { /* frame illisible — ignore */ }
    };

    const unlistenP = listen<string>("player-ended", ({ payload }) => {
      if (payload === id && alive) { setEnded(true); setPlaying(false); }
    });

    playerOpen(id, entry.path, channel)
      .then((info) => { if (alive) setDuration(info.duration); })
      .catch((e) => { if (alive) setError(String(e)); });

    return () => {
      alive = false;
      playerClose(id).catch(() => {});
      unlistenP.then((u) => u());
    };
  }, [entry.path]);

  // Onglet caché → on suspend la pipeline (sinon l'audio continuerait en fond).
  useEffect(() => {
    const id = idRef.current;
    if (!id) return;
    if (!active) { playerPause(id).catch(() => {}); }
    else if (playing && !ended) { playerResume(id).catch(() => {}); }
  }, [active, playing, ended]);

  const toggle = () => {
    const id = idRef.current;
    if (!id) return;
    if (ended) {
      playerSeek(id, 0).then(() => playerResume(id)).catch(() => {});
      setEnded(false); setPlaying(true);
      return;
    }
    if (playing) { playerPause(id).catch(() => {}); setPlaying(false); }
    else { playerResume(id).catch(() => {}); setPlaying(true); }
  };

  const onSeek = (v: number) => {
    const id = idRef.current;
    if (id) playerSeek(id, v).catch(() => {});
    if (ended) { setEnded(false); setPlaying(true); }
  };

  const applyVolume = (v: number, isMuted: boolean) => {
    const id = idRef.current;
    if (id) playerSetVolume(id, isMuted ? 0 : v).catch(() => {});
  };
  const onVolume = (v: number) => { setVolume(v); setMuted(v === 0); applyVolume(v, v === 0); };
  const toggleMute = () => { const m = !muted; setMuted(m); applyVolume(volume, m); };

  // Échap quitte le plein écran ; à la sortie, contrôles toujours visibles.
  useEffect(() => {
    if (!fullscreen) { setControlsVisible(true); if (hideTimer.current) clearTimeout(hideTimer.current); return; }
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [fullscreen]);

  // Auto-hide de la toolbar en plein écran après inactivité (style lecteur).
  const onActivity = () => {
    if (!fullscreen) return;
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
  };
  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current); }, []);

  if (error) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)] px-6 text-center bg-[var(--color-bg)]">{error}</div>;
  }

  const controls = (
    <div
      className={
        fullscreen
          ? `absolute bottom-0 left-0 right-0 flex items-center gap-3 px-4 h-12 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"}`
          : "flex items-center gap-3 px-4 h-11 border-t border-[var(--color-border)] bg-[var(--color-surface)] shrink-0"
      }
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={toggle} className="text-[var(--color-text)] hover:text-[var(--color-accent)]" title={playing ? "Pause" : "Lecture"}>
        {playing ? <Pause width={18} height={18} /> : <Play width={18} height={18} />}
      </button>
      <span ref={timeRef} className="text-[11px] tabular-nums text-[var(--color-text-dim)] w-10">0:00</span>
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
      <span className="text-[11px] tabular-nums text-[var(--color-text-dim)] w-10 text-right">{fmtTime(duration)}</span>

      <button onClick={toggleMute} className="text-[var(--color-text)] hover:text-[var(--color-accent)] shrink-0" title={muted ? "Réactiver le son" : "Couper le son"}>
        {muted || volume === 0 ? <VolumeMute width={17} height={17} /> : <Volume width={17} height={17} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={muted ? 0 : volume}
        onChange={(e) => onVolume(parseFloat(e.target.value))}
        className="w-20 accent-[var(--color-accent)] h-1 shrink-0"
        title="Volume"
      />
      <button onClick={() => setFullscreen((v) => !v)} className="text-[var(--color-text)] hover:text-[var(--color-accent)] shrink-0" title={fullscreen ? "Quitter le plein écran (Échap)" : "Plein écran"}>
        {fullscreen ? <Minimize width={17} height={17} /> : <Maximize width={17} height={17} />}
      </button>
    </div>
  );

  return (
    <div
      className={`flex flex-col bg-[var(--color-bg)] min-h-0 ${fullscreen ? `fixed inset-0 z-[100] bg-black ${controlsVisible ? "" : "cursor-none"}` : "flex-1"}`}
      onMouseMove={onActivity}
    >
      <div className={`flex-1 min-h-0 flex items-center justify-center ${fullscreen ? "" : "p-3"}`} onClick={toggle}>
        <canvas ref={canvasRef} className={`object-contain bg-black ${fullscreen ? "w-full h-full" : "max-w-full max-h-full rounded shadow-lg"}`} />
      </div>
      {controls}
    </div>
  );
}

function AudioPlayer({ entry }: { entry: DirEntry }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    readFileBase64(entry.path)
      .then((b64) => {
        if (cancelled) return;
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const u = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
        revoked = u; setUrl(u);
      })
      .catch((e) => { if (!cancelled) setError(String(e)); });
    return () => { cancelled = true; if (revoked) URL.revokeObjectURL(revoked); };
  }, [entry.path]);

  if (error) return <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)] bg-[var(--color-bg)]">{error}</div>;
  if (!url) return <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)] bg-[var(--color-bg)]">Chargement…</div>;
  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-[var(--color-bg)]">
      <div className="w-full max-w-lg flex flex-col items-center gap-4">
        <div className="text-sm text-[var(--color-text)] truncate w-full text-center">{entry.name}</div>
        <audio src={url} controls className="w-full" />
      </div>
    </div>
  );
}
