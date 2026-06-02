// Panneau d'outils audio : trim, fondu, normalisation, conversion, suppression voix, séparation stems.
import { useEffect, useState } from "react";
import {
  probeMedia, audioTrim, audioFade, audioNormalize, audioConvert, audioRemoveVocals,
} from "../services/media";
import { AudioStemsSection } from "./AudioStemsSection";
import {
  Section, ApplyButton, NumField, OutHint, AudioSelect,
} from "./audio-tools-ui";

interface MediaPanelProps {
  input: string;
  onError: (msg: string) => void;
  onClose: () => void;
  embedded?: boolean;
}

export const AUDIO_FORMATS = ["mp3", "flac", "wav", "ogg", "m4a"] as const;
export type AudioFormat = (typeof AUDIO_FORMATS)[number];

interface PathParts {
  dir: string;
  stem: string;
  ext: string;
}

function splitPath(input: string): PathParts {
  const slash = input.lastIndexOf("/");
  const dir = slash > 0 ? input.slice(0, slash) : "/";
  const base = input.slice(slash + 1);
  const dot = base.lastIndexOf(".");
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1) : "";
  return { dir, stem, ext };
}

function outName(stem: string, suffix: string, ext: string): string {
  return `${stem}_${suffix}.${ext}`;
}

function useEscClose(onClose: () => void): void {
  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
}

export function AudioToolsPanel({ input, onError, onClose, embedded = false }: MediaPanelProps): React.ReactElement {
  const { dir, stem, ext } = splitPath(input);
  const [duration, setDuration] = useState(0);
  const [done, setDone] = useState("");

  useEscClose(onClose);

  useEffect(() => {
    probeMedia(input)
      .then((p) => setDuration(p.duration))
      .catch((e) => onError(String(e)));
  }, [input, onError]);

  const run = async (op: () => Promise<void>, outFile: string): Promise<void> => {
    try {
      await op();
      setDone(outFile);
    } catch (e) {
      onError(String(e));
    }
  };

  const inner = (
    <div
      onClick={(e) => e.stopPropagation()}
      className={embedded
        ? "w-full flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        : "w-[min(560px,94vw)] max-h-[88vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"}
    >
      <PanelHeader title={`${stem}.${ext}`} onClose={onClose} />
      <div className={embedded ? "px-5 pb-2" : "flex-1 overflow-y-auto px-5"}>
        {done && <p className="mt-3 text-xs text-green-400 truncate" title={done}>✓ Exporté : {done}</p>}
        <TrimSection dir={dir} stem={stem} ext={ext} duration={duration} input={input} run={run} />
        <FadeSection dir={dir} stem={stem} ext={ext} input={input} run={run} />
        <SimpleSection
          title="Normaliser"
          outFile={outName(stem, "normalized", ext)}
          onApply={(f) => run(() => audioNormalize(input, `${dir}/${f}`), f)}
        />
        <ConvertSection dir={dir} stem={stem} ext={ext} input={input} run={run} />
        <RemoveVocalsSection dir={dir} stem={stem} ext={ext} input={input} run={run} />
        <div className="py-3">
          <AudioStemsSection input={input} dir={dir} onError={onError} />
        </div>
      </div>
    </div>
  );

  if (embedded) return inner;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      {inner}
    </div>
  );
}

type RunFn = (op: () => Promise<void>, outFile: string) => Promise<void>;
interface OpProps { dir: string; stem: string; ext: string; input: string; run: RunFn; }

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }): React.ReactElement {
  return (
    <div className="flex items-center gap-3 px-5 h-14 border-b border-[var(--color-border)] shrink-0">
      <h2 className="text-base font-medium text-[var(--color-text)]">Outils audio</h2>
      <span className="text-xs text-[var(--color-text-dim)] truncate font-mono">{title}</span>
      <div className="flex-1" />
      <button
        onClick={onClose}
        className="px-2 py-1 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      >
        Fermer
      </button>
    </div>
  );
}

function TrimSection({ dir, stem, ext, duration, input, run }: OpProps & { duration: number }): React.ReactElement {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  useEffect(() => { setEnd(duration); }, [duration]);
  const file = outName(stem, "trim", ext);
  return (
    <Section title="Découper (trim)">
      <div className="flex gap-2">
        <NumField
          label={`Début (s) — max ${duration.toFixed(1)}`}
          value={start}
          onChange={(n) => setStart(Math.min(n, duration))}
        />
        <NumField label="Fin (s)" value={end} onChange={(n) => setEnd(Math.min(n, duration))} />
      </div>
      <OutHint name={file} />
      <ApplyButton onClick={() => void run(() => audioTrim(input, `${dir}/${file}`, start, end), file)} />
    </Section>
  );
}

function FadeSection({ dir, stem, ext, input, run }: OpProps): React.ReactElement {
  const [fadeIn, setFadeIn] = useState(0);
  const [fadeOut, setFadeOut] = useState(0);
  const file = outName(stem, "fade", ext);
  return (
    <Section title="Fondu (fade)">
      <div className="flex gap-2">
        <NumField label="Fondu entrée (s)" value={fadeIn} onChange={setFadeIn} />
        <NumField label="Fondu sortie (s)" value={fadeOut} onChange={setFadeOut} />
      </div>
      <OutHint name={file} />
      <ApplyButton onClick={() => void run(() => audioFade(input, `${dir}/${file}`, fadeIn, fadeOut), file)} />
    </Section>
  );
}

function ConvertSection({ dir, stem, input, run }: OpProps): React.ReactElement {
  const [fmt, setFmt] = useState<AudioFormat>("mp3");
  const [bitrate, setBitrate] = useState("");
  const file = outName(stem, "converted", fmt);
  return (
    <Section title="Convertir">
      <AudioSelect value={fmt} onChange={setFmt} bitrate={bitrate} onBitrate={setBitrate} />
      <OutHint name={file} />
      <ApplyButton onClick={() => void run(() => audioConvert(input, `${dir}/${file}`, bitrate || undefined), file)} />
    </Section>
  );
}

function RemoveVocalsSection({ dir, stem, ext, input, run }: OpProps): React.ReactElement {
  const file = outName(stem, "novocals", ext);
  return (
    <Section title="Supprimer la voix (rapide)">
      <p className="text-xs text-[var(--color-text-dim)]">annule la voix centrée — instantané, sans IA</p>
      <OutHint name={file} />
      <ApplyButton onClick={() => void run(() => audioRemoveVocals(input, `${dir}/${file}`), file)} />
    </Section>
  );
}

function SimpleSection({ title, outFile, onApply }: {
  title: string; outFile: string; onApply: (f: string) => Promise<void>;
}): React.ReactElement {
  return (
    <Section title={title}>
      <OutHint name={outFile} />
      <ApplyButton onClick={() => void onApply(outFile)} />
    </Section>
  );
}
