// Modal global de téléchargement (yt-dlp/spotdl) : URL, sondage, sélection, options, jobs.
import { useEffect } from "react";
import { useDownload } from "../hooks/use-download";
import type { DownloadInfo } from "../types";
import {
  DestinationRow, EntryList, FormatOptions, JobList, accentBtn, fieldCls, ghostBtn,
} from "./download-ui";

interface DownloadModalProps {
  cwd: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

const overlayCls = "fixed inset-0 z-50 flex items-center justify-center bg-black/50";
const modalCls =
  "w-[32rem] max-h-[88vh] overflow-y-auto p-4 rounded-lg border border-[var(--color-border)] " +
  "bg-[var(--color-surface)] shadow-2xl";

function useEscapeClose(onClose: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function Header({ onClose }: { onClose: () => void }): React.ReactElement {
  return (
    <div className="flex items-start justify-between mb-4">
      <h2 className="text-sm font-medium text-[var(--color-text)]">Télécharger</h2>
      <button
        onClick={onClose}
        className="ml-2 shrink-0 text-[var(--color-text-dim)] hover:text-[var(--color-text)] text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}

function UrlBar(
  { url, setUrl, probing, onProbe }: {
    url: string; setUrl: (v: string) => void; probing: boolean; onProbe: () => Promise<void>;
  },
): React.ReactElement {
  return (
    <div className="flex gap-2">
      <input
        autoFocus
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") void onProbe(); }}
        placeholder="URL (YouTube, Spotify, …)"
        className={`flex-1 ${fieldCls}`}
      />
      <button onClick={() => void onProbe()} disabled={probing || !url.trim()} className={accentBtn}>
        {probing ? "…" : "Sonder"}
      </button>
    </div>
  );
}

function ResultHeader({ info }: { info: DownloadInfo }): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--color-text)] truncate" title={info.title}>{info.title}</span>
      <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--color-bg)] text-[var(--color-text-dim)]">
        {info.kind}
      </span>
    </div>
  );
}

function ResultSection({ d }: { d: ReturnType<typeof useDownload> }): React.ReactElement | null {
  if (!d.info) return null;
  const canDownload = d.info.is_playlist ? d.selection.size > 0 : d.info.entries.length > 0;
  return (
    <>
      <ResultHeader info={d.info} />
      {d.info.is_playlist && (
        <EntryList
          info={d.info} selection={d.selection}
          toggle={d.toggle} selectAll={d.selectAll} clearAll={d.clearAll}
        />
      )}
      <FormatOptions info={d.info} options={d.options} setOptions={d.setOptions} />
      <DestinationRow
        dest={d.dest} setDest={d.setDest}
        newFolder={d.newFolder} setNewFolder={d.setNewFolder}
        folderName={d.folderName} setFolderName={d.setFolderName}
      />
      <button
        onClick={() => void d.doDownload()}
        disabled={!canDownload}
        className={`self-start ${accentBtn}`}
      >
        Télécharger
      </button>
    </>
  );
}

export function DownloadModal({ cwd, onClose, onError }: DownloadModalProps): React.ReactElement {
  const d = useDownload(cwd, onError);
  useEscapeClose(onClose);
  return (
    <div className={overlayCls} onClick={onClose}>
      <div className={modalCls} onClick={(e) => e.stopPropagation()}>
        <Header onClose={onClose} />
        <div className="flex flex-col gap-4">
          {d.caps && !d.caps.ytdlp && (
            <div className="px-2 py-1.5 rounded text-xs text-[var(--color-danger)]
              border border-[var(--color-danger)]/40 bg-[var(--color-danger)]/10">
              yt-dlp requis — relance install.sh
            </div>
          )}
          <UrlBar url={d.url} setUrl={d.setUrl} probing={d.probing} onProbe={d.doProbe} />
          <ResultSection d={d} />
          <JobList jobs={d.jobs} onCancel={d.cancelJob} />
        </div>
        {!d.info && !d.probing && (
          <p className={`mt-3 ${ghostBtn} pointer-events-none`}>
            Colle une URL puis clique sur Sonder.
          </p>
        )}
      </div>
    </div>
  );
}
