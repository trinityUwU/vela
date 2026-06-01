// Panneau terminal bas : barre d'onglets + instances xterm.js (une par session PTY).
import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { termInput, termResize } from "../services/term";
import type { TermTab } from "../hooks/useTerminals";

interface Props {
  tabs: TermTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewShell: (shell: string) => void;
  shells: string[];
  onClose: (id: string) => void;
  onExit: (id: string) => void;
  onFollow: () => void;
  onHide: () => void;
}

function shellName(path: string): string {
  return path.split("/").filter(Boolean).pop() || path;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function TerminalPanel(props: Props) {
  const { tabs, activeId } = props;
  const [shellMenu, setShellMenu] = useState(false);
  return (
    <div className="flex flex-col h-full bg-[#0b0c10] border-t border-[var(--color-border)]">
      <div className="flex items-center gap-1 h-8 px-2 bg-[var(--color-surface)] border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-1 flex-1 overflow-x-auto">
          {tabs.map((t) => (
            <div
              key={t.id}
              onClick={() => props.onSelect(t.id)}
              className={`group flex items-center gap-1.5 h-6 px-2 rounded text-xs cursor-pointer whitespace-nowrap ${
                t.id === activeId
                  ? "bg-[var(--color-bg)] text-[var(--color-text)]"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              }`}
            >
              <span className="font-mono">{t.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); props.onClose(t.id); }}
                className="opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)]"
              >
                ×
              </button>
            </div>
          ))}
          <button onClick={props.onNew} title="Nouveau terminal (shell par défaut)"
            className="h-6 px-1.5 rounded text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
            +
          </button>
          {props.shells.length > 0 && (
            <div className="relative">
              <button onClick={() => setShellMenu((v) => !v)} title="Choisir un shell"
                className="h-6 px-1 rounded text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
                ▾
              </button>
              {shellMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShellMenu(false)} />
                  <div className="absolute z-50 top-7 left-0 min-w-32 p-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
                    {props.shells.map((s) => (
                      <button key={s} onClick={() => { props.onNewShell(s); setShellMenu(false); }}
                        className="w-full text-left px-2 py-1 text-xs rounded text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] font-mono">
                        {shellName(s)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
        <button onClick={props.onFollow} title="Suivre le dossier courant"
          className="h-6 px-2 rounded text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-accent)]">
          Suivre
        </button>
        <button onClick={props.onHide} title="Masquer le terminal (Ctrl+`)"
          className="h-6 px-2 rounded text-sm text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
          ▾
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {tabs.map((t) => (
          <TerminalView key={t.id} id={t.id} cwd={t.cwd} active={t.id === activeId} onExit={props.onExit} />
        ))}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-xs text-[var(--color-text-dim)]">
            Aucun terminal — clique sur +
          </div>
        )}
      </div>
    </div>
  );
}

function banner(cwd: string): string {
  const accent = "\x1b[38;2;110;168;254m";
  const dim = "\x1b[2m";
  const reset = "\x1b[0m";
  const date = new Date().toLocaleString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  return `${accent}▌${reset} ${dim}${cwd}${reset}\r\n${accent}▌${reset} ${dim}${date}${reset}\r\n\r\n`;
}

function TerminalView({ id, cwd, active, onExit }: {
  id: string; cwd: string; active: boolean; onExit: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inst = useRef<{ term: Terminal; fit: FitAddon } | null>(null);

  useEffect(() => {
    const term = new Terminal({
      fontFamily: '"JetBrains Mono", "Cascadia Code", monospace',
      fontSize: 13,
      cursorBlink: true,
      theme: { background: "#0b0c10", foreground: "#e6e8ec", cursor: "#6ea8fe" },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(ref.current!);
    inst.current = { term, fit };
    term.write(banner(cwd));

    const fitNow = () => {
      try { fit.fit(); termResize(id, term.cols, term.rows).catch(() => {}); } catch { /* masqué */ }
    };
    // Double rAF : la taille finale du conteneur n'est connue qu'après le layout.
    requestAnimationFrame(() => { fitNow(); requestAnimationFrame(fitNow); });

    const onData = term.onData((data) => termInput(id, data).catch(() => {}));
    const unOut = listen<{ id: string; data: string }>("term-output", ({ payload }) => {
      if (payload.id === id) term.write(b64ToBytes(payload.data));
    });
    const unExit = listen<string>("term-exit", ({ payload }) => {
      if (payload === id) onExit(id);
    });
    const ro = new ResizeObserver(() => {
      try { fit.fit(); termResize(id, term.cols, term.rows).catch(() => {}); } catch { /* masqué */ }
    });
    if (ref.current) ro.observe(ref.current);

    return () => {
      onData.dispose();
      unOut.then((f) => f());
      unExit.then((f) => f());
      ro.disconnect();
      term.dispose();
    };
  }, [id, onExit]);

  useEffect(() => {
    if (!active) return;
    const t = inst.current;
    if (!t) return;
    try { t.fit.fit(); t.term.focus(); termResize(id, t.term.cols, t.term.rows).catch(() => {}); } catch { /* */ }
  }, [active, id]);

  return <div ref={ref} className={`absolute inset-0 p-1 ${active ? "" : "invisible"}`} />;
}
