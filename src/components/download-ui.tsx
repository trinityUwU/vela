// Sous-composants UI du DownloadModal : liste d'entrées lazy, options format, destination, jobs.
import { useState } from "react";
import type { DownloadFormat, DownloadInfo } from "../types";
import type { AudioFormat, DownloadJob, DownloadOptions } from "../hooks/use-download";
import { TERMINAL } from "../hooks/use-download";

export const fieldCls =
  "px-2 py-1 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm " +
  "text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]";
// Select : `appearance-none` retire le chrome natif WebKitGTK (fond clair/dégradé cassé)
// et on dessine notre propre chevron. pr-8 laisse la place à la flèche.
export const selectCls =
  fieldCls + " appearance-none cursor-pointer pr-8";
const chevronStyle: React.CSSProperties = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.5rem center",
};
export const accentBtn =
  "px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-40";
export const ghostBtn =
  "px-2 py-1 rounded text-xs text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]";
const cancelBtn =
  "px-2 py-0.5 text-[10px] rounded border border-[var(--color-danger)]/40 " +
  "text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10";

function fmtDuration(s: number): string {
  if (!s || s < 0) return "--:--";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function fmtSize(bytes: number): string {
  if (bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  return ` · ${mb.toFixed(1)} Mo`;
}

function formatLabel(f: DownloadFormat): string {
  const codec = f.vcodec === "none" ? "audio" : f.vcodec;
  return `${f.note || f.resolution} · ${f.ext} · ${codec}${fmtSize(f.filesize)}`;
}

const AUDIO_FORMATS: AudioFormat[] = ["mp3", "flac", "wav", "m4a", "opus"];

interface EntryListProps {
  info: DownloadInfo;
  selection: Set<string>;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
}

export function EntryList(
  { info, selection, toggle, selectAll, clearAll }: EntryListProps,
): React.ReactElement {
  const [visible, setVisible] = useState(10);
  const shown = info.entries.slice(0, visible);
  const remaining = info.entries.length - shown.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-dim)]">
          {selection.size}/{info.entries.length} sélectionnés
        </span>
        <button onClick={selectAll} className={ghostBtn}>Tout sélectionner</button>
        <button onClick={clearAll} className={ghostBtn}>Tout désélectionner</button>
      </div>
      <div className="max-h-[40vh] overflow-y-auto flex flex-col gap-1 pr-1">
        {shown.map((e) => (
          <label
            key={e.id}
            className="flex items-center gap-2 px-2 py-1 rounded text-xs text-[var(--color-text)]
              hover:bg-[var(--color-surface-hover)] cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selection.has(e.id)}
              onChange={() => toggle(e.id)}
              className="accent-[var(--color-accent)]"
            />
            <span className="truncate flex-1" title={e.title}>{e.title}</span>
            <span className="text-[var(--color-text-dim)]">{fmtDuration(e.duration)}</span>
          </label>
        ))}
        {remaining > 0 && (
          <button onClick={() => setVisible((v) => v + 20)} className={`self-start ${ghostBtn}`}>
            Charger plus ({remaining})
          </button>
        )}
      </div>
    </div>
  );
}

interface FormatOptionsProps {
  info: DownloadInfo;
  options: DownloadOptions;
  setOptions: (patch: Partial<DownloadOptions>) => void;
}

function VideoFormatSelect({ info, options, setOptions }: FormatOptionsProps): React.ReactElement | null {
  if (info.is_playlist || options.audioOnly || info.formats.length === 0) return null;
  return (
    <select
      value={options.formatId}
      onChange={(e) => setOptions({ formatId: e.target.value })}
      className={`w-full ${selectCls}`}
      style={chevronStyle}
    >
      {info.formats.map((f) => (
        <option key={f.format_id} value={f.format_id} className="bg-[var(--color-surface)] text-[var(--color-text)]">
          {formatLabel(f)}
        </option>
      ))}
    </select>
  );
}

function SubtitleChips({ info, options, setOptions }: FormatOptionsProps): React.ReactElement | null {
  if (options.audioOnly || info.subtitle_langs.length === 0) return null;
  const toggleLang = (lang: string): void => {
    const has = options.subLangs.includes(lang);
    setOptions({
      subLangs: has ? options.subLangs.filter((l) => l !== lang) : [...options.subLangs, lang],
    });
  };
  return (
    <div className="flex flex-wrap gap-1">
      <span className="text-xs text-[var(--color-text-dim)] mr-1">Sous-titres :</span>
      {info.subtitle_langs.map((lang) => {
        const on = options.subLangs.includes(lang);
        return (
          <button
            key={lang}
            onClick={() => toggleLang(lang)}
            className={`px-2 py-0.5 rounded text-[10px] ${on
              ? "bg-[var(--color-accent)] text-[var(--color-bg)]"
              : "bg-[var(--color-bg)] text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"}`}
          >
            {lang}
          </button>
        );
      })}
    </div>
  );
}

export function FormatOptions(props: FormatOptionsProps): React.ReactElement {
  const { options, setOptions } = props;
  return (
    <div className="flex flex-col gap-2">
      <VideoFormatSelect {...props} />
      <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={options.audioOnly}
          onChange={(e) => setOptions({ audioOnly: e.target.checked })}
          className="accent-[var(--color-accent)]"
        />
        Audio seulement
      </label>
      {options.audioOnly && (
        <select
          value={options.audioFormat}
          onChange={(e) => setOptions({ audioFormat: e.target.value as AudioFormat })}
          className={`w-full ${selectCls}`}
          style={chevronStyle}
        >
          {AUDIO_FORMATS.map((f) => (
            <option key={f} value={f} className="bg-[var(--color-surface)] text-[var(--color-text)]">{f}</option>
          ))}
        </select>
      )}
      <SubtitleChips {...props} />
    </div>
  );
}

interface DestinationRowProps {
  dest: string;
  setDest: (v: string) => void;
  newFolder: boolean;
  setNewFolder: (v: boolean) => void;
  folderName: string;
  setFolderName: (v: string) => void;
}

export function DestinationRow(p: DestinationRowProps): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <input
        value={p.dest}
        onChange={(e) => p.setDest(e.target.value)}
        placeholder="dossier de destination"
        className={`w-full ${fieldCls}`}
      />
      <label className="flex items-center gap-2 text-xs text-[var(--color-text)]">
        <input
          type="checkbox"
          checked={p.newFolder}
          onChange={(e) => p.setNewFolder(e.target.checked)}
          className="accent-[var(--color-accent)]"
        />
        Créer un nouveau dossier pour ce téléchargement
      </label>
      {p.newFolder && (
        <input
          value={p.folderName}
          onChange={(e) => p.setFolderName(e.target.value)}
          placeholder="nom du dossier"
          className={`w-full ${fieldCls}`}
        />
      )}
    </div>
  );
}

function jobColor(status: string): string {
  if (status === "done") return "text-green-400";
  if (status === "error") return "text-[var(--color-danger)]";
  if (status === "cancelled") return "text-[var(--color-text-dim)]";
  return "text-[var(--color-text-dim)]";
}

function JobRow(
  { job, onCancel }: { job: DownloadJob; onCancel: (id: string) => Promise<void> },
): React.ReactElement {
  const terminal = TERMINAL.includes(job.status);
  const indeterminate = job.status === "running" && job.percent === 0;
  return (
    <div className="flex flex-col gap-1 py-1.5 border-b border-[var(--color-border)]/40 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[var(--color-text)] truncate flex-1" title={job.title}>
          {job.title}
        </span>
        <span className={`text-[10px] ${jobColor(job.status)}`}>
          {indeterminate ? "en cours" : `${job.status} ${job.percent}%`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-bg)] overflow-hidden">
        {indeterminate ? (
          <div className="h-full rounded-full bg-[var(--color-accent)] vela-indeterminate-bar" />
        ) : (
          <div
            className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, job.percent))}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-[var(--color-text-dim)]">
          {job.speed} {job.eta && `· ETA ${job.eta}`}
        </span>
        {!terminal && (
          <button onClick={() => void onCancel(job.jobId)} className={cancelBtn}>Annuler</button>
        )}
      </div>
      {job.status === "error" && job.error && (
        <p className="text-[10px] text-[var(--color-danger)] break-words" title={job.error}>
          {job.error}
        </p>
      )}
    </div>
  );
}

export function JobList(
  { jobs, onCancel }: { jobs: DownloadJob[]; onCancel: (id: string) => Promise<void> },
): React.ReactElement | null {
  if (jobs.length === 0) return null;
  return (
    <div className="flex flex-col max-h-[30vh] overflow-y-auto pr-1">
      {jobs.map((j) => <JobRow key={j.jobId} job={j} onCancel={onCancel} />)}
    </div>
  );
}
