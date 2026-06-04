// Recherche avancée (F05) : critères combinables → résultats cliquables. Enregistrable en dossier intelligent.
import { useEffect, useState } from "react";
import { searchAdvanced, type SearchCriteria } from "../services/advsearch";
import { baseName } from "../services/path-util";
import type { DirEntry } from "../types";

interface Props {
  initial: SearchCriteria;
  autoRun?: boolean;
  onReveal: (path: string) => void;
  onSave: (criteria: SearchCriteria) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1048576).toFixed(1)} Mo`;
}

export function AdvancedSearch({ initial, autoRun, onReveal, onSave, onClose, onError }: Props): React.ReactElement {
  const [c, setC] = useState<SearchCriteria>(initial);
  const [results, setResults] = useState<DirEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof SearchCriteria>(k: K, v: SearchCriteria[K]): void => setC((p) => ({ ...p, [k]: v }));

  const run = (): void => {
    setBusy(true);
    searchAdvanced(c).then(setResults).catch((e) => onError(String(e))).finally(() => setBusy(false));
  };
  useEffect(() => { if (autoRun) run(); /* eslint-disable-next-line */ }, []);

  const mbToBytes = (v: string): number | null => { const n = parseFloat(v); return Number.isNaN(n) ? null : Math.round(n * 1048576); };
  const dateToSec = (v: string): number | null => { const t = Date.parse(v); return Number.isNaN(t) ? null : Math.floor(t / 1000); };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]">
      <div className="flex items-center gap-2 h-11 px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <span className="text-sm font-medium text-[var(--color-text)]">Recherche avancée</span>
        <span className="text-[11px] text-[var(--color-text-dim)] truncate font-mono">{c.root}</span>
        <div className="flex-1" />
        <button onClick={() => onSave(c)} className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Enregistrer ↦ dossier intelligent</button>
        <button onClick={onClose} className="px-2 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Fermer</button>
      </div>

      <div className="grid grid-cols-2 gap-2 px-3 py-2 border-b border-[var(--color-border)] text-xs">
        <Field label="Nom (glob *?)"><Inp v={c.name} on={(v) => set("name", v)} ph="*.pdf" /></Field>
        <Field label="Contient (texte)"><Inp v={c.content} on={(v) => set("content", v)} ph="texte…" /></Field>
        <Field label="Extensions"><Inp v={c.extensions.join(",")} on={(v) => set("extensions", v.split(",").map((e) => e.trim()).filter(Boolean))} ph="pdf,docx" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Taille min (Mo)"><Inp v={c.sizeMin ? String(c.sizeMin / 1048576) : ""} on={(v) => set("sizeMin", mbToBytes(v))} ph="5" /></Field>
          <Field label="Taille max (Mo)"><Inp v={c.sizeMax ? String(c.sizeMax / 1048576) : ""} on={(v) => set("sizeMax", mbToBytes(v))} ph="" /></Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Modifié après"><input type="date" onChange={(e) => set("after", dateToSec(e.target.value))} className="h-8 px-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] outline-none" /></Field>
          <Field label="Modifié avant"><input type="date" onChange={(e) => set("before", dateToSec(e.target.value))} className="h-8 px-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] outline-none" /></Field>
        </div>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-1 text-[var(--color-text)]"><input type="checkbox" checked={c.recursive} onChange={(e) => set("recursive", e.target.checked)} /> Récursif</label>
          <label className="flex items-center gap-1 text-[var(--color-text)]"><input type="checkbox" checked={c.hidden} onChange={(e) => set("hidden", e.target.checked)} /> Cachés</label>
          <button onClick={run} disabled={busy} className="ml-auto px-3 h-8 rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium disabled:opacity-50">Chercher</button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {results === null && <div className="px-3 py-6 text-xs text-[var(--color-text-dim)]">Configure les critères et lance la recherche.</div>}
        {results?.length === 0 && <div className="px-3 py-6 text-xs text-[var(--color-text-dim)]">Aucun résultat.</div>}
        {results?.map((r) => (
          <button key={r.path} onClick={() => onReveal(r.path)}
            className="w-full flex items-center gap-3 px-3 py-1.5 rounded text-left hover:bg-[var(--color-surface-hover)]">
            <span className="text-xs text-[var(--color-text)] truncate flex-1">{baseName(r.path)}</span>
            <span className="text-[10px] text-[var(--color-text-dim)] font-mono truncate max-w-[40%]">{r.path}</span>
            <span className="text-[10px] text-[var(--color-text-dim)] font-mono">{fmtSize(r.size)}</span>
          </button>
        ))}
        {results && results.length >= 300 && <div className="px-3 py-2 text-[11px] text-[var(--color-text-dim)]">300 premiers résultats (affine les critères).</div>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.ReactElement {
  return <label className="flex flex-col gap-1"><span className="text-[var(--color-text-dim)]">{label}</span>{children}</label>;
}

function Inp({ v, on, ph }: { v: string; on: (v: string) => void; ph: string }): React.ReactElement {
  return (
    <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} spellCheck={false}
      className="h-8 px-2 rounded bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] font-mono" />
  );
}
