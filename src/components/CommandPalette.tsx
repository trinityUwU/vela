// Palette de commandes Ctrl+K : fuzzy sur actions (registre) + fichiers du dossier courant + lieux.
import { useEffect, useMemo, useRef, useState } from "react";
import type { DirEntry } from "../types";
import type { Command } from "../hooks/useCommandRegistry";
import { fuzzyScore } from "../services/fuzzy";

interface Item {
  key: string;
  title: string;
  hint?: string;
  group: string;
  run: () => void;
}

interface Props {
  commands: Command[];
  entries: DirEntry[];
  onOpenEntry: (e: DirEntry) => void;
  onClose: () => void;
}

const MAX = 40;

export function CommandPalette({ commands, entries, onOpenEntry, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Autofocus fiable sous WebKitGTK : rAF (le focus immédiat échoue parfois).
  useEffect(() => {
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => { setActive(0); }, [query]);
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest" }); }, [active]);

  const items = useMemo<Item[]>(() => {
    const cmds: Item[] = commands.map((c) => ({ key: c.id, title: c.title, hint: c.hint ?? c.group, group: c.group, run: c.run }));
    if (!query) return cmds.slice(0, MAX);
    const files: Item[] = entries.map((e) => ({
      key: `file:${e.path}`, title: e.name, hint: e.is_dir ? "dossier" : e.extension, group: "Fichiers", run: () => onOpenEntry(e),
    }));
    return [...cmds, ...files]
      .map((it) => ({ it, s: fuzzyScore(query, it.title) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, MAX)
      .map((x) => x.it);
  }, [query, commands, entries, onOpenEntry]);

  const choose = (it?: Item) => { if (it) { it.run(); onClose(); } };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); choose(items[active]); }
    else if (e.key === "Escape") { e.preventDefault(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh] bg-black/40" onClick={onClose}>
      <div
        className="w-[min(640px,90vw)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Tape une action, un fichier, un lieu…"
          className="w-full px-4 py-3 bg-transparent text-[var(--color-text)] outline-none border-b border-[var(--color-border)]"
        />
        <div className="max-h-[50vh] overflow-auto py-1">
          {items.length === 0 && (
            <div className="px-4 py-3 text-sm text-[var(--color-text-dim)]">Aucun résultat</div>
          )}
          {items.map((it, i) => (
            <button
              key={it.key}
              ref={i === active ? activeRef : undefined}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(it)}
              className={`w-full flex items-center justify-between gap-4 px-4 py-2 text-left text-sm ${
                i === active ? "bg-[var(--color-surface-hover)]" : ""
              }`}
            >
              <span className="truncate text-[var(--color-text)]">{it.title}</span>
              <span className="shrink-0 text-xs text-[var(--color-text-dim)] truncate max-w-[45%]">{it.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
