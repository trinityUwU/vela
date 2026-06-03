// Panel fixe bas-droite : liste des extractions en cours, avec progression et contrôles.
import { useRef, useState } from "react";
import {
  extractionPause, extractionResume, extractionCancel, extractionProvidePassword,
  transferPause, transferResume, transferCancel,
} from "../services/fs";
import type { ExtractionJob, TransferJob, OcrJob } from "../types";

interface Props {
  jobs: Map<string, ExtractionJob>;
  transfers: Map<string, TransferJob>;
  ocr: Map<string, OcrJob>;
  onNavigate: (path: string) => void;
}

export function ExtractionPanel({ jobs, transfers, ocr, onNavigate }: Props) {
  if (jobs.size === 0 && transfers.size === 0 && ocr.size === 0) return null;
  const active =
    [...jobs.values()].filter((j) => !["done", "error", "cancelled"].includes(j.status)).length +
    [...transfers.values()].filter((t) => t.status === "transferring").length +
    [...ocr.values()].filter((o) => o.status === "running").length;

  return (
    <div className="fixed bottom-3 right-3 z-50 w-80 flex flex-col gap-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden">
      <div className="px-3 py-2 text-[11px] font-medium text-[var(--color-text-dim)] border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0">
        {active > 0 ? `${active} opération${active > 1 ? "s" : ""} en cours` : "Activité"}
      </div>
      <div className="max-h-64 overflow-y-auto divide-y divide-[var(--color-border)]/50">
        {[...transfers.values()].map((t) => (
          <TransferRow key={t.id} job={t} />
        ))}
        {[...jobs.values()].map((job) => (
          <JobRow key={job.id} job={job} onNavigate={onNavigate} />
        ))}
        {[...ocr.values()].map((job) => (
          <OcrRow key={job.id} job={job} onNavigate={onNavigate} />
        ))}
      </div>
    </div>
  );
}

function fmtBytes(b: number): string {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} Mo`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} Go`;
}

function TransferRow({ job }: { job: TransferJob }) {
  const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : null;
  const verb = job.kind === "copy" ? "Copie" : "Déplacement";
  const isPaused = job.status === "paused";
  const terminal = job.status === "done" || job.status === "error" || job.status === "cancelled";
  const canPause = !terminal;
  const canCancel = !terminal;

  const label =
    job.status === "done" ? "Terminé"
    : job.status === "error" ? "Erreur"
    : job.status === "cancelled" ? "Annulé"
    : isPaused ? "En pause"
    : pct !== null ? `${pct}%` : "En cours…";
  const labelCls =
    job.status === "done" ? "text-green-400"
    : job.status === "error" ? "text-[var(--color-danger)]"
    : isPaused ? "text-amber-400"
    : "text-[var(--color-text-dim)]";

  return (
    <div className="px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="flex-1 text-xs text-[var(--color-text)] truncate font-medium" title={job.name}>
          {verb} · {job.name}
        </span>
        <span className={`text-[10px] shrink-0 ${labelCls}`}>{label}</span>
      </div>
      <span className="text-[10px] text-[var(--color-text-dim)] font-mono">
        {fmtBytes(job.current)} / {fmtBytes(job.total)}
      </span>
      {!terminal && <ProgressBar pct={pct} paused={isPaused} />}
      {job.status === "error" && job.error && (
        <p className="text-[10px] text-[var(--color-danger)] break-words">{job.error}</p>
      )}
      {(canPause || canCancel) && (
        <div className="flex items-center gap-1.5">
          {canPause && (
            <CtrlBtn
              onClick={() => isPaused
                ? transferResume(job.id).catch(() => {})
                : transferPause(job.id).catch(() => {})}
            >
              {isPaused ? "Reprendre" : "Pause"}
            </CtrlBtn>
          )}
          {canCancel && (
            <CtrlBtn danger onClick={() => transferCancel(job.id).catch(() => {})}>
              Annuler
            </CtrlBtn>
          )}
        </div>
      )}
    </div>
  );
}

function JobRow({ job, onNavigate }: { job: ExtractionJob; onNavigate: (p: string) => void }) {
  const [pwdInput, setPwdInput] = useState("");
  const pwdRef = useRef<HTMLInputElement>(null);

  const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : null;
  const isPaused = job.status === "paused";
  const isDone = job.status === "done";
  const isError = job.status === "error";
  const isCancelled = job.status === "cancelled";
  const needsPwd = job.status === "password_required";
  const terminal = isDone || isError || isCancelled;

  const handlePwd = () => {
    if (!pwdInput.trim()) return;
    extractionProvidePassword(job.id, pwdInput).catch(() => {});
    setPwdInput("");
  };

  return (
    <div className="px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="flex-1 text-xs text-[var(--color-text)] truncate font-medium" title={job.archiveName}>
          {job.archiveName}
        </span>
        <StatusBadge job={job} />
      </div>

      <span className="text-[10px] text-[var(--color-text-dim)] font-mono truncate" title={job.dest}>
        {job.dest}
      </span>

      {!terminal && !needsPwd && (
        <ProgressBar pct={pct} paused={isPaused} />
      )}

      {isError && job.error && (
        <p className="text-[10px] text-[var(--color-danger)] break-words">{job.error}</p>
      )}

      {needsPwd && (
        <div className="flex gap-1.5 mt-0.5">
          <input
            ref={pwdRef}
            type="password"
            value={pwdInput}
            autoFocus
            onChange={(e) => setPwdInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handlePwd(); }}
            placeholder="Mot de passe de l'archive…"
            className="flex-1 h-6 px-2 text-[11px] rounded bg-[var(--color-bg)] border border-[var(--color-accent)] text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-dim)]"
          />
          <button
            onClick={handlePwd}
            disabled={!pwdInput.trim()}
            className="px-2 h-6 text-[11px] rounded bg-[var(--color-accent)] text-white disabled:opacity-40"
          >
            OK
          </button>
        </div>
      )}

      {!terminal && !needsPwd && (
        <div className="flex items-center gap-1.5">
          <CtrlBtn
            onClick={() => isPaused
              ? extractionResume(job.id).catch(() => {})
              : extractionPause(job.id).catch(() => {})}
          >
            {isPaused ? "Reprendre" : "Pause"}
          </CtrlBtn>
          <CtrlBtn danger onClick={() => extractionCancel(job.id).catch(() => {})}>
            Annuler
          </CtrlBtn>
          <button
            onClick={() => onNavigate(job.dest)}
            className="ml-auto text-[10px] text-[var(--color-accent)] hover:underline"
          >
            Aller au dossier
          </button>
        </div>
      )}

      {isDone && (
        <div className="flex justify-end">
          <button onClick={() => onNavigate(job.dest)} className="text-[10px] text-[var(--color-accent)] hover:underline">
            Ouvrir le dossier
          </button>
        </div>
      )}
    </div>
  );
}

function OcrRow({ job, onNavigate }: { job: OcrJob; onNavigate: (p: string) => void }) {
  const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : null;
  const label =
    job.status === "done" ? "Terminé" : job.status === "error" ? "Erreur" : pct !== null ? `${pct}%` : "En cours…";
  const labelCls =
    job.status === "done" ? "text-green-400" : job.status === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-text-dim)]";
  return (
    <div className="px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <span className="flex-1 text-xs text-[var(--color-text)] truncate font-medium" title={job.name}>
          OCR · {job.name}
        </span>
        <span className={`text-[10px] shrink-0 ${labelCls}`}>{label}</span>
      </div>
      {job.status === "running" && <ProgressBar pct={pct} paused={false} />}
      {job.status === "error" && job.error && (
        <p className="text-[10px] text-[var(--color-danger)] break-words">{job.error}</p>
      )}
      {job.status === "done" && (
        <div className="flex justify-end">
          <button
            onClick={() => onNavigate(job.dest.slice(0, job.dest.lastIndexOf("/")) || "/")}
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            Aller au fichier
          </button>
        </div>
      )}
    </div>
  );
}

function ProgressBar({ pct, paused }: { pct: number | null; paused: boolean }) {
  return (
    <div className="h-1 rounded-full bg-[var(--color-bg)] overflow-hidden">
      {pct !== null ? (
        <div
          className={`h-full rounded-full transition-all duration-300 ${paused ? "bg-[var(--color-text-dim)]" : "bg-[var(--color-accent)]"}`}
          style={{ width: `${pct}%` }}
        />
      ) : (
        <div className={`h-full w-1/3 rounded-full ${paused ? "bg-[var(--color-text-dim)]" : "bg-[var(--color-accent)] animate-pulse"}`} />
      )}
    </div>
  );
}

function StatusBadge({ job }: { job: ExtractionJob }) {
  const pct = job.total > 0 ? `${Math.round((job.current / job.total) * 100)}%` : null;
  const map: Record<string, { label: string; cls: string }> = {
    extracting:        { label: pct ?? "En cours…", cls: "text-[var(--color-text-dim)]" },
    paused:            { label: "En pause",         cls: "text-amber-400" },
    done:              { label: "Terminé",           cls: "text-green-400" },
    error:             { label: "Erreur",            cls: "text-[var(--color-danger)]" },
    cancelled:         { label: "Annulé",            cls: "text-[var(--color-text-dim)]" },
    password_required: { label: "Mot de passe",      cls: "text-amber-400" },
  };
  const { label, cls } = map[job.status] ?? { label: job.status, cls: "" };
  return <span className={`text-[10px] shrink-0 ${cls}`}>{label}</span>;
}

function CtrlBtn({ children, onClick, danger }: {
  children: React.ReactNode; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 text-[10px] rounded border transition-colors ${
        danger
          ? "border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
          : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
      }`}
    >
      {children}
    </button>
  );
}
