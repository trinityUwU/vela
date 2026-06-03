// Modal de traduction locale d'un fichier texte : choix langue source/cible, install paquet à la volée.
import { useState } from "react";
import { translateFile, translateInstallLang, LANGUAGES } from "../services/translate";

interface Props {
  path: string;
  onDone: (dest: string) => void;
  onClose: () => void;
}

type Phase = "idle" | "translating" | "installing" | "missing" | "error";

export function TranslateModal({ path, onDone, onClose }: Props) {
  const [from, setFrom] = useState("en");
  const [to, setTo] = useState("fr");
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState("");

  const run = async (): Promise<void> => {
    setPhase("translating");
    setMsg("");
    try {
      const dest = await translateFile(path, from, to);
      onDone(dest);
    } catch (e) {
      const err = String(e);
      if (err.startsWith("LANG_MISSING")) { setPhase("missing"); }
      else if (err.includes("ARGOS_MISSING")) {
        setPhase("error");
        setMsg("Argos Translate n'est pas installé. Relance ./install.sh ou installe le venv translate-venv.");
      } else { setPhase("error"); setMsg(err); }
    }
  };

  const installAndRetry = async (): Promise<void> => {
    setPhase("installing");
    try {
      await translateInstallLang(from, to);
      await run();
    } catch (e) {
      setPhase("error");
      setMsg(`Téléchargement du paquet échoué : ${String(e)}`);
    }
  };

  const busy = phase === "translating" || phase === "installing";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[28rem] p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-sm font-medium text-[var(--color-text)] mb-3">Traduire le fichier</h2>
        <div className="flex items-center gap-2 mb-4">
          <LangSelect label="De" value={from} onChange={setFrom} disabled={busy} />
          <span className="text-[var(--color-text-dim)] mt-5">→</span>
          <LangSelect label="Vers" value={to} onChange={setTo} disabled={busy} />
        </div>

        {phase === "missing" && (
          <p className="text-[11px] text-amber-400 mb-3">
            Le paquet de langue {from}→{to} n'est pas installé. Le télécharger maintenant (une fois, puis offline) ?
          </p>
        )}
        {phase === "installing" && <p className="text-[11px] text-[var(--color-text-dim)] mb-3">Téléchargement du paquet…</p>}
        {phase === "translating" && <p className="text-[11px] text-[var(--color-text-dim)] mb-3">Traduction en cours…</p>}
        {phase === "error" && <p className="text-[11px] text-[var(--color-danger)] mb-3 break-words">{msg}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]">
            Fermer
          </button>
          {phase === "missing" ? (
            <button onClick={installAndRetry} className="px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)]">
              Télécharger le paquet
            </button>
          ) : (
            <button
              onClick={run}
              disabled={busy || from === to}
              className="px-3 py-1.5 rounded text-sm bg-[var(--color-accent)] text-[var(--color-bg)] disabled:opacity-40"
            >
              Traduire
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LangSelect({ label, value, onChange, disabled }: {
  label: string; value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  return (
    <label className="flex-1 flex flex-col gap-1">
      <span className="text-[10px] text-[var(--color-text-dim)]">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] appearance-none cursor-pointer"
      >
        {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>
    </label>
  );
}
