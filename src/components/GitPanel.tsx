// Panneau git (zone de profil) : statut + sélection à valider, commit, bascule de branche, historique.
import { useEffect, useState } from "react";
import type { GitState } from "../hooks/useGitStatus";
import type { GitCommit } from "../services/git";
import { gitBranches, gitLog, gitStage, gitCommit, gitCheckoutBranch } from "../services/git";

interface Props {
  git: GitState;
  cwd: string;
  onError: (msg: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  modified: "#e2b340",
  new: "#4caf50",
  deleted: "#e0524f",
  renamed: "#5b9bd5",
  ignored: "#6b7280",
};

function basename(p: string): string {
  return p.split("/").filter(Boolean).pop() ?? p;
}

export function GitPanel({ git, cwd, onError }: Props) {
  const repo = git.repoRoot ?? cwd;
  const files = Array.from(git.statusMap.entries()).map(([path, status]) => ({ path, status }));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [branches, setBranches] = useState<string[]>([]);
  const [log, setLog] = useState<GitCommit[]>([]);

  useEffect(() => { setSelected(new Set(files.map((f) => f.path))); }, [git.statusMap]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!git.repoRoot) { setBranches([]); setLog([]); return; }
    gitBranches(repo).then(setBranches).catch(() => setBranches([]));
    gitLog(repo, 15).then(setLog).catch(() => setLog([]));
  }, [git.repoRoot, git.branch, repo]);

  if (!git.repoRoot) {
    return <div className="flex-1 p-4 text-sm text-[var(--color-text-dim)]">Pas un dépôt git.</div>;
  }

  const toggle = (path: string) =>
    setSelected((s) => { const n = new Set(s); n.has(path) ? n.delete(path) : n.add(path); return n; });

  const commit = () => {
    const paths = files.filter((f) => selected.has(f.path)).map((f) => f.path);
    if (!paths.length || !message.trim()) return;
    gitStage(repo, paths)
      .then(() => gitCommit(repo, message.trim()))
      .then(() => { setMessage(""); git.refresh(); })
      .catch((e) => onError(String(e)));
  };

  return (
    <div className="flex-1 min-w-64 flex flex-col border-l border-[var(--color-border)] min-h-0">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--color-border)] text-sm">
        <span className="text-[var(--color-text-dim)]">⎇</span>
        <select
          value={git.branch ?? ""}
          onChange={(e) => gitCheckoutBranch(repo, e.target.value).then(git.refresh).catch((err) => onError(String(err)))}
          className="bg-transparent text-[var(--color-text)] outline-none appearance-none"
        >
          {git.branch && !branches.includes(git.branch) && <option>{git.branch}</option>}
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {files.length === 0 && <div className="p-3 text-xs text-[var(--color-text-dim)]">Rien à valider.</div>}
        {files.map((f) => (
          <label key={f.path} className="flex items-center gap-2 px-3 py-1 text-sm hover:bg-[var(--color-surface-hover)] cursor-pointer">
            <input type="checkbox" checked={selected.has(f.path)} onChange={() => toggle(f.path)} />
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLOR[f.status] ?? "#888" }} />
            <span className="truncate text-[var(--color-text)]" title={f.path}>{basename(f.path)}</span>
          </label>
        ))}
      </div>

      <div className="border-t border-[var(--color-border)] p-2 flex flex-col gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Message de commit…"
          rows={2}
          className="w-full resize-none bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-2 py-1 text-sm text-[var(--color-text)] outline-none"
        />
        <button
          onClick={commit}
          disabled={!message.trim() || selected.size === 0}
          className="px-3 py-1.5 rounded bg-[var(--color-accent)] text-[var(--color-bg)] text-sm disabled:opacity-40"
        >
          Valider ({selected.size})
        </button>
      </div>

      <div className="max-h-40 overflow-auto border-t border-[var(--color-border)] py-1">
        {log.map((c) => (
          <div key={c.id} className="px-3 py-0.5 text-xs text-[var(--color-text-dim)] truncate">
            <span className="text-[var(--color-text)]">{c.id}</span> {c.summary}
          </div>
        ))}
      </div>
    </div>
  );
}
