// Recherche sémantique de code via CodeIndex : requête en français, résultats classés, clic = navigation.
import { useState } from "react";
import { codeindexSearch, codeindexIndex, type CodeHit } from "../services/codeindex";

interface Props {
  project: string;
  onReveal: (path: string) => void;
  onClose: () => void;
}

type Phase = "idle" | "searching" | "error";

export function CodeSearchModal({ project, onReveal, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CodeHit[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");

  const search = async (): Promise<void> => {
    if (!query.trim()) return;
    setPhase("searching");
    setMsg("");
    try {
      const res = await codeindexSearch(project, query.trim());
      setHits(res);
      setPhase("idle");
      if (res.length === 0) setMsg("Aucun résultat — le projet est-il indexé ?");
    } catch (e) {
      const err = String(e);
      setPhase("error");
      setMsg(err.includes("CODEINDEX_MISSING") ? "CodeIndex n'est pas installé sur cette machine." : err);
    }
  };

  const reindex = async (): Promise<void> => {
    try {
      // Job de fond : progression et annulation gérées dans le panneau d'activité (bas-droite).
      await codeindexIndex(project);
      setPhase("idle");
      setMsg("Indexation lancée — suivez la progression en bas à droite, puis relancez la recherche.");
    } catch (e) {
      const err = String(e);
      setPhase("error");
      setMsg(err.includes("CODEINDEX_MISSING") ? "CodeIndex n'est pas installé sur cette machine." : err);
    }
  };

  const busy = phase === "searching";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/50" onClick={onClose}>
      <div
        className="w-[44rem] max-h-[70vh] flex flex-col p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-2">
          <input
            autoFocus
            value={query}
            disabled={busy}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") search(); if (e.key === "Escape") onClose(); }}
            placeholder="Rechercher dans le code (en français)…"
            className="flex-1 px-3 py-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
          />
          <button onClick={search} disabled={busy || !query.trim()}
            className="px-3 py-2 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-40">
            Chercher
          </button>
        </div>

        <p className="text-[10px] text-[var(--color-text-dim)] mb-2 truncate" title={project}>
          {project}
          <button onClick={reindex} disabled={busy} className="ml-2 text-[var(--color-accent)] hover:underline disabled:opacity-40">
            réindexer
          </button>
        </p>

        {msg && <p className={`text-[11px] mb-2 ${phase === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-text-dim)]"}`}>{msg}</p>}
        {phase === "searching" && <p className="text-[11px] text-[var(--color-text-dim)] mb-2">Recherche…</p>}

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]/40">
          {hits.map((h) => (
            <button
              key={h.relative_path}
              onClick={() => { onReveal(`${project}/${h.relative_path}`); onClose(); }}
              className="w-full text-left px-2 py-2 hover:bg-[var(--color-surface-hover)] flex flex-col gap-0.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text)] font-medium truncate flex-1">{h.relative_path}</span>
                <span className="text-[10px] text-[var(--color-accent)] shrink-0">{h.cluster}</span>
                <span className="text-[10px] text-[var(--color-text-dim)] shrink-0 font-mono">{h.relevance_score.toFixed(2)}</span>
              </div>
              {h.summary && <span className="text-[10px] text-[var(--color-text-dim)] line-clamp-2">{h.summary}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
