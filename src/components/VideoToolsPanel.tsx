// Modal d'outils vidéo : découpe, extraction d'image/audio, conversion/compression avec progression.
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  probeMedia, videoTrim, videoExtractFrame, videoExtractAudio,
  videoConvert, videoConvertCancel,
} from "../services/media";
import type { VideoProgress } from "../types";

interface MediaPanelProps {
  input: string;
  onError: (msg: string) => void;
  onClose: () => void;
  embedded?: boolean;
}

interface PathParts {
  dir: string;
  stem: string;
  ext: string;
}

type AudioFormat = "m4a" | "mp3" | "wav";

function parsePath(input: string): PathParts {
  const slash = Math.max(input.lastIndexOf("/"), input.lastIndexOf("\\"));
  const dir = slash >= 0 ? input.slice(0, slash) : "";
  const base = slash >= 0 ? input.slice(slash + 1) : input;
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : "";
  return { dir, stem, ext };
}

function basename(path: string): string {
  const slash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return slash >= 0 ? path.slice(slash + 1) : path;
}

const applyBtn = "px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-40";
const fieldBase =
  "px-2 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm " +
  "text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
const numInput = `w-24 ${fieldBase}`;
const cancelBtn =
  "self-start px-2 py-0.5 text-[10px] rounded border border-[var(--color-danger)]/40 " +
  "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10";

function useDuration(input: string, onError: (msg: string) => void): number {
  const [duration, setDuration] = useState(0);
  useEffect(() => {
    const probe = async (): Promise<void> => {
      try {
        const p = await probeMedia(input);
        setDuration(p.duration);
      } catch (e) {
        onError(String(e));
      }
    };
    void probe();
  }, [input]);
  return duration;
}

function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

const overlayCls = "fixed inset-0 z-50 flex items-center justify-center bg-black/50";
const modalCls =
  "w-[28rem] max-h-[85vh] overflow-y-auto p-4 rounded-lg border border-[var(--color-border)] " +
  "bg-[var(--color-surface)] shadow-2xl";

const embeddedCls =
  "w-full p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl";

export function VideoToolsPanel({ input, onError, onClose, embedded = false }: MediaPanelProps): React.ReactElement {
  const { dir, stem, ext } = parsePath(input);
  const sep = dir ? "/" : "";
  const duration = useDuration(input, onError);
  useEscapeClose(onClose);

  const inner = (
    <div className={embedded ? embeddedCls : modalCls} onClick={(e) => e.stopPropagation()}>
      <Header filename={basename(input)} onClose={onClose} />
      <div className="flex flex-col gap-4">
        <TrimSection input={input} dir={dir} sep={sep} stem={stem} ext={ext} duration={duration} onError={onError} />
        <FrameSection input={input} dir={dir} sep={sep} stem={stem} duration={duration} onError={onError} />
        <AudioSection input={input} dir={dir} sep={sep} stem={stem} onError={onError} />
        <ConvertSection input={input} dir={dir} sep={sep} stem={stem} onError={onError} />
      </div>
    </div>
  );

  if (embedded) return inner;
  return <div className={overlayCls} onClick={onClose}>{inner}</div>;
}

function Header({ filename, onClose }: { filename: string; onClose: () => void }): React.ReactElement {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-[var(--color-text)]">Outils vidéo</h2>
        <p className="text-xs text-[var(--color-text-dim)] truncate" title={filename}>{filename}</p>
      </div>
      <button
        onClick={onClose}
        className="ml-2 shrink-0 text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

function SectionShell(
  { title, note, output, done, children }: {
    title: string; note?: string; output: string; done: string | null; children: React.ReactNode;
  },
): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 pb-4 border-b border-[var(--color-border)]/50 last:border-0 last:pb-0">
      <h3 className="text-sm font-medium text-[var(--color-text)]">{title}</h3>
      {note && <p className="text-xs text-[var(--color-text-dim)]">{note}</p>}
      {children}
      <p className="text-[10px] font-mono text-[var(--color-text-dim)] truncate" title={output}>→ {output}</p>
      {done && <p className="text-[10px] text-green-400">✓ Exporté : {done}</p>}
    </div>
  );
}

interface SectionBase {
  input: string;
  dir: string;
  sep: string;
  stem: string;
  onError: (msg: string) => void;
}

function TrimSection(
  { input, dir, sep, stem, ext, duration, onError }: SectionBase & { ext: string; duration: number },
): React.ReactElement {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => { setEnd(duration); }, [duration]);
  const output = `${dir}${sep}${stem}_trim${ext}`;

  const apply = async (): Promise<void> => {
    setDone(null);
    try {
      await videoTrim(input, output, start, end);
      setDone(basename(output));
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <SectionShell
      title="Découper"
      note="Sans réencodage, instantané (coupe au keyframe le plus proche)."
      output={output}
      done={done}
    >
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
        <label className="flex items-center gap-1">Début
          <input type="number" min={0} max={duration} step={0.1} value={start}
            onChange={(e) => setStart(Number(e.target.value))} className={numInput} />
        </label>
        <label className="flex items-center gap-1">Fin
          <input type="number" min={0} max={duration} step={0.1} value={end}
            onChange={(e) => setEnd(Number(e.target.value))} className={numInput} />
        </label>
        <span>s</span>
      </div>
      <button onClick={() => void apply()} disabled={end <= start} className={`self-start ${applyBtn}`}>
        Appliquer
      </button>
    </SectionShell>
  );
}

function FrameSection(
  { input, dir, sep, stem, duration, onError }: SectionBase & { duration: number },
): React.ReactElement {
  const [timestamp, setTimestamp] = useState(0);
  const [done, setDone] = useState<string | null>(null);
  const output = `${dir}${sep}${stem}_frame.png`;

  const apply = async (): Promise<void> => {
    setDone(null);
    try {
      await videoExtractFrame(input, output, timestamp);
      setDone(basename(output));
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <SectionShell title="Extraire une image" output={output} done={done}>
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
        <label className="flex items-center gap-1">Instant
          <input type="number" min={0} max={duration} step={0.1} value={timestamp}
            onChange={(e) => setTimestamp(Number(e.target.value))} className={numInput} />
        </label>
        <span>s</span>
      </div>
      <button onClick={() => void apply()} className={`self-start ${applyBtn}`}>Appliquer</button>
    </SectionShell>
  );
}

function AudioSection({ input, dir, sep, stem, onError }: SectionBase): React.ReactElement {
  const [format, setFormat] = useState<AudioFormat>("m4a");
  const [done, setDone] = useState<string | null>(null);
  const output = `${dir}${sep}${stem}_audio.${format}`;

  const apply = async (): Promise<void> => {
    setDone(null);
    try {
      await videoExtractAudio(input, output);
      setDone(basename(output));
    } catch (e) {
      onError(String(e));
    }
  };

  return (
    <SectionShell title="Extraire l'audio" output={output} done={done}>
      <div className="flex items-center gap-2">
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as AudioFormat)}
          className={fieldBase}
        >
          {(["m4a", "mp3", "wav"] as const).map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={() => void apply()} className={applyBtn}>Appliquer</button>
      </div>
    </SectionShell>
  );
}

interface ConvertJob {
  percent: number;
  status: string;
  running: boolean;
  apply: (crf: number) => Promise<void>;
  cancel: () => Promise<void>;
}

interface ConvertState {
  setPercent: (v: number) => void;
  setStatus: (v: string) => void;
  setRunning: (v: boolean) => void;
  jobRef: React.MutableRefObject<string>;
}

function makeApply(
  input: string, output: string, onError: (msg: string) => void, st: ConvertState,
): (crf: number) => Promise<void> {
  return async (crf: number): Promise<void> => {
    const jobId = crypto.randomUUID();
    st.jobRef.current = jobId;
    st.setPercent(0);
    st.setStatus("running");
    st.setRunning(true);
    try {
      await videoConvert(jobId, input, output, crf);
    } catch (e) {
      onError(String(e));
      st.setRunning(false);
    }
  };
}

function useConvertJob(input: string, output: string, onError: (msg: string) => void): ConvertJob {
  const [percent, setPercent] = useState(0);
  const [status, setStatus] = useState("");
  const [running, setRunning] = useState(false);
  const jobRef = useRef<string>("");

  useEffect(() => {
    const un = listen<VideoProgress>("video-progress", ({ payload: p }) => {
      if (p.job_id !== jobRef.current) return;
      setPercent(p.percent);
      setStatus(p.status);
      if (["done", "error", "cancelled"].includes(p.status)) setRunning(false);
    });
    return () => { void un.then((f) => f()); };
  }, []);

  const apply = makeApply(input, output, onError, { setPercent, setStatus, setRunning, jobRef });
  const cancel = async (): Promise<void> => {
    try {
      await videoConvertCancel(jobRef.current);
    } catch (e) {
      onError(String(e));
    }
  };

  return { percent, status, running, apply, cancel };
}

function ConvertSection({ input, dir, sep, stem, onError }: SectionBase): React.ReactElement {
  const [crf, setCrf] = useState(23);
  const output = `${dir}${sep}${stem}_compressed.mp4`;
  const { percent, status, running, apply, cancel } = useConvertJob(input, output, onError);

  return (
    <SectionShell title="Convertir / compresser" output={output} done={status === "done" ? basename(output) : null}>
      <ConvertControls crf={crf} setCrf={setCrf} running={running} onApply={() => apply(crf)} />
      {running && <ConvertProgress percent={percent} status={status} onCancel={cancel} />}
    </SectionShell>
  );
}

function ConvertControls(
  { crf, setCrf, running, onApply }: {
    crf: number; setCrf: (v: number) => void; running: boolean; onApply: () => Promise<void>;
  },
): React.ReactElement {
  return (
    <>
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-dim)]">
        <span className="w-32">Qualité (CRF {crf})</span>
        <input
          type="range" min={18} max={32} value={crf}
          onChange={(e) => setCrf(Number(e.target.value))}
          disabled={running}
          className="flex-1 accent-[var(--color-accent)]"
        />
      </div>
      <p className="text-[10px] text-[var(--color-text-dim)]">Plus bas = meilleure qualité (fichier plus lourd).</p>
      <button onClick={() => void onApply()} disabled={running} className={`self-start ${applyBtn}`}>
        Appliquer
      </button>
    </>
  );
}

function ConvertProgress(
  { percent, status, onCancel }: { percent: number; status: string; onCancel: () => Promise<void> },
): React.ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-[var(--color-text-dim)]">{status} {percent}%</span>
      <div className="h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
      <button onClick={() => void onCancel()} className={cancelBtn}>Annuler</button>
    </div>
  );
}
