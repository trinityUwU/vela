// Hook orchestrateur du DownloadModal : probe, sélection, options, lancement et suivi des jobs.
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { capabilities, probe, start, cancel } from "../services/download";
import type { DownloadCapabilities, DownloadInfo, DownloadProgress } from "../types";

export type AudioFormat = "mp3" | "flac" | "wav" | "m4a" | "opus";

export interface DownloadJob {
  jobId: string;
  title: string;
  percent: number;
  status: string;
  speed: string;
  eta: string;
  error?: string;
}

export interface DownloadOptions {
  audioOnly: boolean;
  audioFormat: AudioFormat;
  formatId: string;
  subLangs: string[];
}

export interface UseDownload {
  url: string;
  setUrl: (v: string) => void;
  info: DownloadInfo | null;
  caps: DownloadCapabilities | null;
  probing: boolean;
  selection: Set<string>;
  options: DownloadOptions;
  setOptions: (patch: Partial<DownloadOptions>) => void;
  dest: string;
  setDest: (v: string) => void;
  newFolder: boolean;
  setNewFolder: (v: boolean) => void;
  folderName: string;
  setFolderName: (v: string) => void;
  jobs: DownloadJob[];
  doProbe: () => Promise<void>;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  doDownload: () => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim().slice(0, 120) || "download";
}

const TERMINAL = ["done", "error", "cancelled"];

function useJobEvents(setJobs: React.Dispatch<React.SetStateAction<DownloadJob[]>>): void {
  useEffect(() => {
    const un = listen<DownloadProgress>("download-progress", ({ payload: p }) => {
      setJobs((prev) =>
        prev.map((j) =>
          j.jobId === p.job_id
            ? { ...j, percent: p.percent, status: p.status, speed: p.speed, eta: p.eta, error: p.error }
            : j,
        ),
      );
    });
    return () => { void un.then((f) => f()); };
  }, [setJobs]);
}

function useCapabilities(onError: (msg: string) => void): DownloadCapabilities | null {
  const [caps, setCaps] = useState<DownloadCapabilities | null>(null);
  useEffect(() => {
    const load = async (): Promise<void> => {
      try {
        setCaps(await capabilities());
      } catch (e) {
        onError(String(e));
      }
    };
    void load();
  }, []);
  return caps;
}

function selectedEntries(info: DownloadInfo, selection: Set<string>): DownloadInfo["entries"] {
  if (!info.is_playlist) return info.entries.slice(0, 1);
  return info.entries.filter((e) => selection.has(e.id));
}

interface CoreState {
  url: string;
  info: DownloadInfo | null;
  setInfo: (v: DownloadInfo | null) => void;
  setProbing: (v: boolean) => void;
  setSelection: React.Dispatch<React.SetStateAction<Set<string>>>;
  setFolderName: (v: string) => void;
  setOptionsState: React.Dispatch<React.SetStateAction<DownloadOptions>>;
  options: DownloadOptions;
  dest: string;
  newFolder: boolean;
  folderName: string;
  setJobs: React.Dispatch<React.SetStateAction<DownloadJob[]>>;
}

function makeProbe(s: CoreState, onError: (msg: string) => void): () => Promise<void> {
  return async (): Promise<void> => {
    const trimmed = s.url.trim();
    if (!trimmed) return;
    s.setProbing(true);
    try {
      const result = await probe(trimmed);
      s.setInfo(result);
      s.setSelection(new Set(result.entries.map((e) => e.id)));
      s.setFolderName(sanitize(result.title));
      s.setOptionsState({
        audioOnly: false, audioFormat: "mp3",
        formatId: result.formats[0]?.format_id ?? "", subLangs: [],
      });
    } catch (e) {
      onError(String(e));
    } finally {
      s.setProbing(false);
    }
  };
}

async function startEntry(
  s: CoreState, entry: DownloadInfo["entries"][number], destDir: string, onError: (m: string) => void,
): Promise<void> {
  const { info, options } = s;
  if (!info) return;
  const jobId = crypto.randomUUID();
  s.setJobs((prev) => [
    ...prev, { jobId, title: entry.title, percent: 0, status: "running", speed: "", eta: "" },
  ]);
  try {
    await start({
      jobId, url: entry.url,
      formatId: info.is_playlist || options.audioOnly ? undefined : options.formatId || undefined,
      destDir, audioOnly: options.audioOnly,
      audioFormat: options.audioOnly ? options.audioFormat : undefined,
      subLangs: options.audioOnly ? undefined : options.subLangs,
      isSpotify: info.kind === "spotify",
    });
  } catch (e) {
    onError(String(e));
    s.setJobs((prev) => prev.map((j) => (j.jobId === jobId ? { ...j, status: "error" } : j)));
  }
}

function makeDownload(
  s: CoreState, selection: Set<string>, onError: (msg: string) => void,
): () => Promise<void> {
  return async (): Promise<void> => {
    if (!s.info) return;
    const destDir = s.newFolder && s.folderName.trim() ? `${s.dest}/${s.folderName.trim()}` : s.dest;
    for (const entry of selectedEntries(s.info, selection)) await startEntry(s, entry, destDir, onError);
  };
}

interface DownloadActions {
  doProbe: () => Promise<void>;
  toggle: (id: string) => void;
  selectAll: () => void;
  clearAll: () => void;
  doDownload: () => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
}

function useDownloadActions(
  s: CoreState, selection: Set<string>, onError: (msg: string) => void,
): DownloadActions {
  const toggle = (id: string): void =>
    s.setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const selectAll = (): void => s.setSelection(new Set((s.info?.entries ?? []).map((e) => e.id)));
  const clearAll = (): void => s.setSelection(new Set());
  const cancelJob = async (jobId: string): Promise<void> => {
    try {
      await cancel(jobId);
    } catch (e) {
      onError(String(e));
    }
  };
  return {
    doProbe: makeProbe(s, onError), toggle, selectAll, clearAll,
    doDownload: makeDownload(s, selection, onError), cancelJob,
  };
}

export function useDownload(cwd: string, onError: (msg: string) => void): UseDownload {
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [probing, setProbing] = useState(false);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [options, setOptionsState] = useState<DownloadOptions>({
    audioOnly: false, audioFormat: "mp3", formatId: "", subLangs: [],
  });
  const [dest, setDest] = useState(cwd);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [jobs, setJobs] = useState<DownloadJob[]>([]);

  const caps = useCapabilities(onError);
  useJobEvents(setJobs);
  const actions = useDownloadActions(
    { url, info, setInfo, setProbing, setSelection, setFolderName, setOptionsState,
      options, dest, newFolder, folderName, setJobs },
    selection, onError,
  );

  const setOptions = (patch: Partial<DownloadOptions>): void =>
    setOptionsState((o) => ({ ...o, ...patch }));

  return {
    url, setUrl, info, caps, probing, selection, options, setOptions,
    dest, setDest, newFolder, setNewFolder, folderName, setFolderName, jobs,
    ...actions,
  };
}

export { TERMINAL, sanitize };
