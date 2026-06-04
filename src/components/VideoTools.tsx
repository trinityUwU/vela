// Boîte à outils vidéo (F18) : vidéo → GIF, compresser à une taille cible, brûler des sous-titres .srt.
// Non-destructif : produit un nouveau fichier. Opérations ffmpeg (longues) — feedback simple busy/done.
import { useState } from "react";
import { videoToGif, videoTargetSize, videoSubtitles } from "../services/video";
import { baseName, parentDir } from "../services/path-util";

interface Props {
  path: string;
  onDone: (out: string) => void;
  onClose: () => void;
  onError: (msg: string) => void;
}

type Tab = "gif" | "compress" | "subs";

export function VideoTools({ path, onDone, onClose, onError }: Props): React.ReactElement {
  const [tab, setTab] = useState<Tab>("gif");
  const [busy, setBusy] = useState(false);
  const stem = baseName(path).replace(/\.[^.]+$/, "");
  const dir = parentDir(path);

  // GIF
  const [start, setStart] = useState("0");
  const [dur, setDur] = useState("3");
  const [fps, setFps] = useState("12");
  const [width, setWidth] = useState("480");
  // compress
  const [targetMb, setTargetMb] = useState("25");
  // subs
  const [srt, setSrt] = useState("");

  const run = (p: Promise<void>, out: string): void => {
    setBusy(true);
    p.then(() => onDone(out)).catch((e) => { onError(String(e)); setBusy(false); });
  };

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60" onClick={busy ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-[min(460px,92vw)] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-[var(--color-text)] truncate">Outils vidéo · {baseName(path)}</h2>
        <div className="flex gap-1">
          {(["gif", "compress", "subs"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-2.5 py-1 text-xs rounded ${tab === t ? "bg-[var(--color-accent)] text-[var(--color-bg)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"}`}>
              {t === "gif" ? "→ GIF" : t === "compress" ? "Compresser" : "Sous-titres"}
            </button>
          ))}
        </div>

        {tab === "gif" && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <F l="Début (s)"><I v={start} on={setStart} /></F>
            <F l="Durée (s)"><I v={dur} on={setDur} /></F>
            <F l="FPS"><I v={fps} on={setFps} /></F>
            <F l="Largeur (px)"><I v={width} on={setWidth} /></F>
            <button disabled={busy} onClick={() => run(
              videoToGif(path, `${dir}/${stem}.gif`, parseFloat(start) || 0, parseFloat(dur) || 3, parseInt(fps) || 12, parseInt(width) || 480),
              `${dir}/${stem}.gif`,
            )} className="col-span-2 h-8 rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium disabled:opacity-50">
              {busy ? "Génération…" : "Créer le GIF"}
            </button>
          </div>
        )}

        {tab === "compress" && (
          <div className="flex flex-col gap-2 text-xs">
            <F l="Taille cible (Mo)"><I v={targetMb} on={setTargetMb} /></F>
            <button disabled={busy} onClick={() => run(
              videoTargetSize(path, `${dir}/${stem}_compressed.mp4`, parseFloat(targetMb) || 25),
              `${dir}/${stem}_compressed.mp4`,
            )} className="h-8 rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium disabled:opacity-50">
              {busy ? "Compression…" : "Compresser"}
            </button>
          </div>
        )}

        {tab === "subs" && (
          <div className="flex flex-col gap-2 text-xs">
            <F l="Chemin du .srt"><I v={srt} on={setSrt} ph="/chemin/vers/sous-titres.srt" /></F>
            <button disabled={busy || !srt.trim()} onClick={() => run(
              videoSubtitles(path, srt.trim(), `${dir}/${stem}_subbed.mp4`),
              `${dir}/${stem}_subbed.mp4`,
            )} className="h-8 rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium disabled:opacity-50">
              {busy ? "Incrustation…" : "Brûler les sous-titres"}
            </button>
          </div>
        )}

        {!busy && <div className="flex justify-end"><button onClick={onClose} className="px-3 py-1.5 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Fermer</button></div>}
      </div>
    </div>
  );
}

function F({ l, children }: { l: string; children: React.ReactNode }): React.ReactElement {
  return <label className="flex flex-col gap-1"><span className="text-[var(--color-text-dim)]">{l}</span>{children}</label>;
}
function I({ v, on, ph }: { v: string; on: (v: string) => void; ph?: string }): React.ReactElement {
  return <input value={v} onChange={(e) => on(e.target.value)} placeholder={ph} spellCheck={false}
    className="h-8 px-2 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] font-mono" />;
}
