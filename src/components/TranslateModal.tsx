// Traducteur local complet (Argos) : texte saisi/collé ou fichier, langues source/cible, install à la volée.
import { useEffect, useState } from "react";
import { translateText, translateInstallLang, LANGUAGES } from "../services/translate";
import { readFile, writeFile } from "../services/fs";

interface Props {
  path?: string | null;
  onClose: () => void;
}

type Phase = "idle" | "translating" | "installing" | "missing" | "error" | "saved";

export function TranslateModal({ path, onClose }: Props) {
  const [from, setFrom] = useState("fr");
  const [to, setTo] = useState("en");
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (path) readFile(path).then(setInput).catch((e) => { setPhase("error"); setMsg(String(e)); });
  }, [path]);

  const run = async (): Promise<void> => {
    if (!input.trim()) return;
    setPhase("translating"); setMsg("");
    try {
      setOutput(await translateText(input, from, to));
      setPhase("idle");
    } catch (e) {
      const err = String(e);
      if (err.startsWith("LANG_MISSING")) setPhase("missing");
      else if (err.includes("ARGOS_MISSING")) { setPhase("error"); setMsg("Argos Translate n'est pas installé (relance ./install.sh)."); }
      else { setPhase("error"); setMsg(err); }
    }
  };

  const installAndRetry = async (): Promise<void> => {
    setPhase("installing");
    try { await translateInstallLang(from, to); await run(); }
    catch (e) { setPhase("error"); setMsg(`Téléchargement du paquet échoué : ${String(e)}`); }
  };

  const save = async (): Promise<void> => {
    if (!path || !output) return;
    const dot = path.lastIndexOf(".");
    const dest = `${dot > 0 ? path.slice(0, dot) : path}.${to}.txt`;
    try { await writeFile(dest, output); setPhase("saved"); setMsg(`Enregistré : ${dest}`); }
    catch (e) { setPhase("error"); setMsg(String(e)); }
  };

  const swap = (): void => { setFrom(to); setTo(from); setInput(output || input); setOutput(""); };
  const busy = phase === "translating" || phase === "installing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[52rem] max-h-[80vh] flex flex-col p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-medium text-[var(--color-text)] flex-1">Traducteur</h2>
          <LangSelect value={from} onChange={setFrom} disabled={busy} />
          <button onClick={swap} disabled={busy} title="Inverser"
            className="px-2 py-1.5 rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">⇄</button>
          <LangSelect value={to} onChange={setTo} disabled={busy} />
        </div>

        <div className="flex gap-3 flex-1 min-h-0">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} disabled={busy}
            placeholder="Texte à traduire (saisir ou coller)…"
            className="flex-1 min-h-40 p-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] resize-none" />
          <textarea value={output} readOnly placeholder="Traduction…"
            className="flex-1 min-h-40 p-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none resize-none" />
        </div>

        {phase === "missing" && (
          <p className="text-[11px] text-amber-400 mt-2">
            Paquet de langue {from}→{to} non installé. Le télécharger maintenant (une fois, puis offline) ?
          </p>
        )}
        {phase === "installing" && <p className="text-[11px] text-[var(--color-text-dim)] mt-2">Téléchargement du paquet…</p>}
        {phase === "translating" && <p className="text-[11px] text-[var(--color-text-dim)] mt-2">Traduction…</p>}
        {(phase === "error" || phase === "saved") && (
          <p className={`text-[11px] mt-2 break-words ${phase === "error" ? "text-[var(--color-danger)]" : "text-green-400"}`}>{msg}</p>
        )}

        <div className="flex items-center gap-2 mt-3">
          {output && <CopyBtn text={output} />}
          {path && output && (
            <button onClick={save} className="px-3 py-1.5 rounded text-sm border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
              Enregistrer dans un fichier
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 rounded text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]">Fermer</button>
            {phase === "missing" ? (
              <button onClick={installAndRetry} className="px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)]">Télécharger le paquet</button>
            ) : (
              <button onClick={run} disabled={busy || from === to || !input.trim()}
                className="px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-40">Traduire</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = (): void => { navigator.clipboard.writeText(text).then(() => { setDone(true); setTimeout(() => setDone(false), 1500); }).catch(() => {}); };
  return (
    <button onClick={copy} className="px-3 py-1.5 rounded text-sm border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
      {done ? "Copié ✓" : "Copier"}
    </button>
  );
}

function LangSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}
      className="px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] appearance-none cursor-pointer">
      {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
    </select>
  );
}
