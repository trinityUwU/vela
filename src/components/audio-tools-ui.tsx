// Primitives UI partagées du panneau audio : section, bouton appliquer, champs, sélecteur de format.
import { AUDIO_FORMATS } from "./AudioToolsPanel";
import type { AudioFormat } from "./AudioToolsPanel";

const FIELD_CLS =
  "w-full px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] " +
  "text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";

export function Section({ title, children }: {
  title: string; children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2 py-3 border-b border-[var(--color-border)]">
      <h3 className="text-sm font-medium text-[var(--color-text)]">{title}</h3>
      {children}
    </div>
  );
}

export function ApplyButton({ onClick, label }: {
  onClick: () => void; label?: string;
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="self-start px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)]"
    >
      {label ?? "Appliquer"}
    </button>
  );
}

export function NumField({ label, value, onChange }: {
  label: string; value: number; onChange: (n: number) => void;
}): React.ReactElement {
  return (
    <label className="flex flex-col gap-1 text-xs text-[var(--color-text-dim)]">
      {label}
      <input
        type="number"
        min={0}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={FIELD_CLS}
      />
    </label>
  );
}

export function OutHint({ name }: { name: string }): React.ReactElement {
  return (
    <span className="text-[10px] font-mono text-[var(--color-text-dim)] truncate" title={name}>
      → {name}
    </span>
  );
}

export function AudioSelect({ value, onChange, bitrate, onBitrate }: {
  value: AudioFormat;
  onChange: (f: AudioFormat) => void;
  bitrate: string;
  onBitrate: (b: string) => void;
}): React.ReactElement {
  return (
    <div className="flex gap-2">
      {/* cast sûr : value ne peut être qu'une des AUDIO_FORMATS rendues en options */}
      <select value={value} onChange={(e) => onChange(e.target.value as AudioFormat)} className={`flex-1 ${FIELD_CLS}`}>
        {AUDIO_FORMATS.map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
      </select>
      <input
        value={bitrate}
        onChange={(e) => onBitrate(e.target.value)}
        placeholder="bitrate (ex: 192k)"
        className={`flex-1 ${FIELD_CLS} placeholder:text-[var(--color-text-dim)]`}
      />
    </div>
  );
}
