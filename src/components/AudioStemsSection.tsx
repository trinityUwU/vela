// Section séparation de stems (demucs) : installation, séparation IA et suivi de progression.
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import {
  stemsStatus, stemsSeparate, stemsInstall, stemsCancel,
} from "../services/media";
import type { StemsProgress, StemsInstallProgress } from "../types";

interface Props {
  input: string;
  dir: string;
  onError: (msg: string) => void;
}

type Phase = "loading" | "missing" | "ready" | "installing" | "separating";
type StemMode = "full" | "vocals";

const BTN_CLS = "px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)]";

function ProgressBar({ pct }: { pct: number }): React.ReactElement {
  return (
    <div className="h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden">
      <div
        className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

function ModeToggle({ mode, onSelect }: {
  mode: StemMode; onSelect: (m: StemMode) => void;
}): React.ReactElement {
  return (
    <div className="flex gap-2">
      {(["full", "vocals"] as const).map((m) => (
        <button
          key={m}
          onClick={() => onSelect(m)}
          className={`flex-1 px-3 py-1.5 rounded text-sm transition-colors ${
            mode === m
              ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
              : "bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          {m === "full" ? "4 stems complets" : "Voix + accompagnement"}
        </button>
      ))}
    </div>
  );
}

function CancelBtn({ onClick }: { onClick: () => void }): React.ReactElement {
  const cls =
    "self-start px-2 py-0.5 text-[10px] rounded border border-[var(--color-danger)]/40 " +
    "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10";
  return <button onClick={onClick} className={cls}>Annuler</button>;
}

interface StemsState {
  phase: Phase;
  mode: StemMode;
  percent: number;
  status: string;
  installLine: string;
}

type Patch = (p: Partial<StemsState>) => void;
type JobRef = React.MutableRefObject<string>;

async function doSeparate(
  input: string, dir: string, mode: StemMode,
  jobRef: JobRef, patch: Patch, onError: (m: string) => void,
): Promise<void> {
  const jobId = crypto.randomUUID();
  jobRef.current = jobId;
  patch({ percent: 0, status: "", phase: "separating" });
  try {
    await stemsSeparate(jobId, input, dir, mode === "vocals" ? "vocals" : undefined);
  } catch (e) {
    onError(String(e));
    patch({ phase: "ready" });
  }
}

async function doInstall(jobRef: JobRef, patch: Patch, onError: (m: string) => void): Promise<void> {
  const jobId = crypto.randomUUID();
  jobRef.current = jobId;
  patch({ installLine: "", status: "", phase: "installing" });
  try {
    await stemsInstall(jobId);
  } catch (e) {
    onError(String(e));
    patch({ phase: "missing" });
  }
}

function useStems(input: string, dir: string, onError: (msg: string) => void) {
  const [state, setState] = useState<StemsState>({
    phase: "loading", mode: "full", percent: 0, status: "", installLine: "",
  });
  const jobRef = useRef<string>("");
  const patch: Patch = (p) => setState((s) => ({ ...s, ...p }));

  const refresh = async (): Promise<void> => {
    try {
      const s = await stemsStatus();
      patch({ phase: s.installed ? "ready" : "missing" });
    } catch (e) {
      onError(String(e));
      patch({ phase: "missing" });
    }
  };

  useEffect(() => { void refresh(); }, []);
  useStemsEvents(jobRef, patch, refresh);

  const separate = (): Promise<void> => doSeparate(input, dir, state.mode, jobRef, patch, onError);
  const install = (): Promise<void> => doInstall(jobRef, patch, onError);
  const cancel = async (): Promise<void> => {
    try {
      await stemsCancel(jobRef.current);
    } catch (e) {
      onError(String(e));
    }
  };

  return { state, patch, separate, install, cancel };
}

function useStemsEvents(
  jobRef: React.MutableRefObject<string>,
  patch: (p: Partial<StemsState>) => void,
  refresh: () => Promise<void>,
): void {
  useEffect(() => {
    const unSep = listen<StemsProgress>("stems-progress", ({ payload: p }) => {
      if (p.job_id !== jobRef.current) return;
      patch({ percent: p.percent, status: p.status });
      if (["done", "error", "cancelled"].includes(p.status)) patch({ phase: "ready" });
    });
    const unInst = listen<StemsInstallProgress>("stems-install-progress", ({ payload: p }) => {
      if (p.job_id !== jobRef.current) return;
      patch({ installLine: p.line, status: p.status });
      if (p.status === "done") void refresh();
      else if (p.status === "error" || p.status === "cancelled") patch({ phase: "missing" });
    });
    return () => { void unSep.then((f) => f()); void unInst.then((f) => f()); };
  }, []);
}

export function AudioStemsSection({ input, dir, onError }: Props): React.ReactElement {
  const { state, patch, separate, install, cancel } = useStems(input, dir, onError);
  const { phase, mode, percent, status, installLine } = state;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-sm font-medium text-[var(--color-text)]">Séparation stems (IA — demucs)</h3>
        <p className="text-xs text-[var(--color-text-dim)] mt-0.5">
          {phase === "missing"
            ? "demucs non installé — séparation de qualité professionnelle (voix, batterie, basse, autres)."
            : `Les pistes apparaîtront dans ${dir}/htdemucs/`}
        </p>
      </div>

      {phase === "loading" && <span className="text-xs text-[var(--color-text-dim)]">Vérification…</span>}

      {phase === "missing" && (
        <button onClick={() => void install()} className={BTN_CLS}>Installer demucs (~2 Go)</button>
      )}

      {phase === "installing" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--color-text-dim)]">Installation… {status}</span>
          <p className="text-[10px] font-mono text-[var(--color-text-dim)] truncate" title={installLine}>
            {installLine}
          </p>
        </div>
      )}

      {phase === "ready" && (
        <div className="flex flex-col gap-2">
          <ModeToggle mode={mode} onSelect={(m) => patch({ mode: m })} />
          <button onClick={() => void separate()} className={BTN_CLS}>Séparer</button>
        </div>
      )}

      {phase === "separating" && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs text-[var(--color-text-dim)]">{status || "Séparation…"} {percent}%</span>
          <ProgressBar pct={percent} />
          <CancelBtn onClick={() => void cancel()} />
        </div>
      )}
    </div>
  );
}
