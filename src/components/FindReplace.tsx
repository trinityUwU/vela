// Rechercher & remplacer multi-fichiers (F06) : critères → prévisualisation par fichier → application.
// Sécurité : application par fichier coché, enregistrée dans useUndo (Ctrl+Z restaure les contenus d'origine).
import { useState } from "react";
import { searchReplacePreview, searchReplaceApply, type FileMatches, type ReplaceCriteria } from "../services/replace";
import { baseName } from "../services/path-util";

interface Props {
  root: string;
  onApplied: (originals: { path: string; content: string }[], summary: string) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function FindReplace({ root, onApplied, onClose, onError }: Props): React.ReactElement {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [isRegex, setIsRegex] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [exts, setExts] = useState("");
  const [matches, setMatches] = useState<FileMatches[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const criteria = (): ReplaceCriteria => ({
    root, find, replace, isRegex, caseSensitive, wholeWord,
    extensions: exts.split(",").map((e) => e.trim()).filter(Boolean),
  });

  const preview = (): void => {
    if (!find) return;
    setBusy(true);
    searchReplacePreview(criteria())
      .then((m) => { setMatches(m); setPicked(new Set(m.map((f) => f.path))); })
      .catch((e) => onError(String(e)))
      .finally(() => setBusy(false));
  };

  const apply = (): void => {
    const files = [...picked];
    if (!files.length) return;
    setBusy(true);
    searchReplaceApply(criteria(), files)
      .then((r) => onApplied(r.originals, `${r.count} remplacement(s) dans ${r.files} fichier(s)`))
      .catch((e) => onError(String(e)))
      .finally(() => setBusy(false));
  };

  const toggle = (path: string): void =>
    setPicked((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  const totalCount = (matches ?? []).filter((m) => picked.has(m.path)).reduce((s, m) => s + m.count, 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]">
      <div className="flex items-center gap-2 h-11 px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <span className="text-sm font-medium text-[var(--color-text)]">Rechercher & remplacer</span>
        <span className="text-[11px] text-[var(--color-text-dim)] truncate font-mono">{root}</span>
        <div className="flex-1" />
        <button onClick={onClose} className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Fermer</button>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] flex-wrap">
        <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Chercher" spellCheck={false}
          className="flex-1 min-w-40 h-8 px-2 text-xs font-mono rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]" />
        <input value={replace} onChange={(e) => setReplace(e.target.value)} placeholder="Remplacer par" spellCheck={false}
          className="flex-1 min-w-40 h-8 px-2 text-xs font-mono rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]" />
        <input value={exts} onChange={(e) => setExts(e.target.value)} placeholder="ext: ts,tsx" spellCheck={false}
          className="w-28 h-8 px-2 text-xs font-mono rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] outline-none" />
        <Chk label="Regex" v={isRegex} on={() => setIsRegex((x) => !x)} />
        <Chk label="Aa" v={caseSensitive} on={() => setCaseSensitive((x) => !x)} />
        <Chk label="Mot" v={wholeWord} on={() => setWholeWord((x) => !x)} />
        <button onClick={preview} disabled={!find || busy} className="px-3 h-8 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium disabled:opacity-50">Prévisualiser</button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {matches === null && <div className="px-3 py-6 text-xs text-[var(--color-text-dim)]">Saisis un terme et prévisualise.</div>}
        {matches?.length === 0 && <div className="px-3 py-6 text-xs text-[var(--color-text-dim)]">Aucune occurrence.</div>}
        {matches?.map((m) => (
          <div key={m.path} className="mb-2 rounded border border-[var(--color-border)] overflow-hidden">
            <label className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface)] cursor-pointer">
              <input type="checkbox" checked={picked.has(m.path)} onChange={() => toggle(m.path)} />
              <span className="text-xs text-[var(--color-text)] truncate flex-1">{baseName(m.path)}</span>
              <span className="text-[11px] text-[var(--color-text-dim)] font-mono">{m.count}×</span>
            </label>
            {m.samples.map((o, i) => (
              <div key={i} className="px-3 py-1 text-[11px] font-mono border-t border-[var(--color-border)]/40">
                <span className="text-[var(--color-text-dim)] mr-2">{o.line}</span>
                <span className="text-[var(--color-danger)] line-through">{o.before}</span>
                <span className="block text-[var(--color-text-dim)] mr-2 pl-6 text-[var(--color-accent)]">{o.after}</span>
              </div>
            ))}
          </div>
        ))}
      </div>

      {matches && matches.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
          <span className="text-xs text-[var(--color-text-dim)]">{totalCount} remplacement(s) dans {picked.size} fichier(s)</span>
          <div className="flex-1" />
          <button onClick={apply} disabled={!picked.size || busy} className="px-3 h-8 text-xs rounded bg-[var(--color-danger)] text-[var(--color-bg)] font-medium disabled:opacity-50">
            Remplacer
          </button>
        </div>
      )}
    </div>
  );
}

function Chk({ label, v, on }: { label: string; v: boolean; on: () => void }): React.ReactElement {
  return (
    <button onClick={on} className={`px-2 h-8 text-xs rounded border ${v ? "border-[var(--color-accent)] text-[var(--color-accent)]" : "border-[var(--color-border)] text-[var(--color-text-dim)]"}`}>
      {label}
    </button>
  );
}
