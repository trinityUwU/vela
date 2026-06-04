// Panneau git (zone de profil) : branche + ahead/behind, sections indexé/modifié avec stage/unstage
// par fichier, commit des fichiers indexés, historique. Clic sur un fichier → ouverture dans l'éditeur.
import { useEffect, useState } from "react";
import type { GitState } from "../hooks/useGitStatus";
import type { GitCommit, GitFileStatus } from "../services/git";
import { gitBranches, gitLog, gitStage, gitUnstage, gitCommit, gitCheckoutBranch } from "../services/git";
import { gitColor, GIT_LABEL } from "../services/git-ui";

interface Props {
  git: GitState;
  cwd: string;
  onError: (msg: string) => void;
  onOpenFile: (path: string) => void;
}

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

export function GitPanel({ git, cwd, onError, onOpenFile }: Props) {
  const repo = git.repoRoot ?? cwd;
  const [message, setMessage] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [log, setLog] = useState<GitCommit[]>([]);

  useEffect(() => {
    if (!git.repoRoot) { setBranches([]); setLog([]); return; }
    gitBranches(repo).then(setBranches).catch(() => setBranches([]));
    gitLog(repo, 20).then(setLog).catch(() => setLog([]));
  }, [git.repoRoot, git.branch, repo, git.statusMap]);

  if (!git.repoRoot) {
    return <div className="flex-1 p-4 text-sm text-[var(--color-text-dim)]">Pas un dépôt git.</div>;
  }

  const staged = git.files.filter((f) => f.staged);
  const unstaged = git.files.filter((f) => !f.staged);
  const run = (p: Promise<unknown>) => p.then(() => git.refresh()).catch((e) => onError(String(e)));

  const commit = () => {
    if (!staged.length || !message.trim()) return;
    gitCommit(repo, message.trim()).then(() => { setMessage(""); git.refresh(); }).catch((e) => onError(String(e)));
  };

  return (
    <div className="flex-1 min-w-64 flex flex-col border-l border-[var(--color-border)] min-h-0">
      <GitHeader git={git} repo={repo} branches={branches} onError={onError} />

      <div className="flex-1 overflow-auto min-h-0">
        {git.files.length === 0 && <div className="p-3 text-xs text-[var(--color-text-dim)]">Arbre propre — rien à valider.</div>}
        <Section title="Indexé" count={staged.length} action="−" actionTitle="Désindexer"
          files={staged} onAction={(p) => run(gitUnstage(repo, [p]))} onOpen={onOpenFile} onAll={staged.length ? () => run(gitUnstage(repo, staged.map((f) => f.path))) : undefined} />
        <Section title="Modifications" count={unstaged.length} action="+" actionTitle="Indexer"
          files={unstaged} onAction={(p) => run(gitStage(repo, [p]))} onOpen={onOpenFile} onAll={unstaged.length ? () => run(gitStage(repo, unstaged.map((f) => f.path))) : undefined} />
      </div>

      <div className="border-t border-[var(--color-border)] p-2 flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={staged.length ? "Message de commit…" : "Indexe des fichiers pour commiter"}
          rows={2}
          className="w-full resize-none bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-[var(--color-text)] outline-none"
        />
        <button
          onClick={commit}
          disabled={!message.trim() || staged.length === 0}
          className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-[var(--color-bg)] text-sm disabled:opacity-40"
        >
          Valider {staged.length > 0 && `(${staged.length})`}
        </button>
      </div>

      <div className="max-h-44 overflow-auto border-t border-[var(--color-border)] py-1">
        {log.map((c) => (
          <div key={c.id} className="px-3 py-0.5 text-xs truncate" title={`${c.author} — ${c.summary}`}>
            <span className="text-[var(--color-accent)] font-mono">{c.id}</span>{" "}
            <span className="text-[var(--color-text)]">{c.summary}</span>{" "}
            <span className="text-[var(--color-text-dim)]">· {c.author}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GitHeader({ git, repo, branches, onError }: {
  git: GitState; repo: string; branches: string[]; onError: (m: string) => void;
}) {
  const [ahead, behind] = git.aheadBehind;
  return (
    <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--color-border)] text-sm shrink-0">
      <span className="text-[var(--color-text-dim)]">⎇</span>
      <select
        value={git.branch ?? ""}
        onChange={(e) => gitCheckoutBranch(repo, e.target.value).then(git.refresh).catch((err) => onError(String(err)))}
        className="bg-transparent text-[var(--color-text)] outline-none appearance-none flex-1 truncate"
      >
        {git.branch && !branches.includes(git.branch) && <option>{git.branch}</option>}
        {branches.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>
      {ahead > 0 && <span className="text-[var(--color-text-dim)] shrink-0" title="commits d'avance">↑{ahead}</span>}
      {behind > 0 && <span className="text-[var(--color-text-dim)] shrink-0" title="commits de retard">↓{behind}</span>}
    </div>
  );
}

function Section({ title, count, action, actionTitle, files, onAction, onOpen, onAll }: {
  title: string; count: number; action: string; actionTitle: string; files: GitFileStatus[];
  onAction: (path: string) => void; onOpen: (path: string) => void; onAll?: () => void;
}) {
  if (count === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1 text-[11px] uppercase tracking-wide text-[var(--color-text-dim)] sticky top-0 bg-[var(--color-bg)]">
        <span>{title} ({count})</span>
        {onAll && <button onClick={onAll} className="hover:text-[var(--color-text)]" title={`${actionTitle} tout`}>{action} tout</button>}
      </div>
      {files.map((f) => (
        <div key={f.path} className="group flex items-center gap-2 px-3 py-1 text-sm hover:bg-[var(--color-surface-hover)]">
          <button
            onClick={() => onAction(f.path)}
            title={actionTitle}
            className="w-4 shrink-0 text-[var(--color-text-dim)] hover:text-[var(--color-accent)] font-mono"
          >
            {action}
          </button>
          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: gitColor(f.status) }} title={GIT_LABEL[f.status] ?? f.status} />
          <button onClick={() => onOpen(f.path)} className="truncate text-left text-[var(--color-text)] flex-1" title={f.path}>
            {basename(f.path)}
          </button>
        </div>
      ))}
    </div>
  );
}
