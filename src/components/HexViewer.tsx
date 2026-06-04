// Visualiseur hexadécimal (F10) : offset | 16 octets hex | ASCII, virtualisé (fenêtres de lecture,
// jamais le fichier entier). Lecture seule. Jump à un offset + recherche hex/ASCII.
import { useCallback, useEffect, useRef, useState } from "react";
import { readByteRange } from "../services/fs";
import { baseName } from "../services/path-util";

const ROW = 16; // octets par ligne
const LINE_H = 18;
const WINDOW = 8192; // octets chargés autour de la zone visible
const SCAN = 65536; // taille de fenêtre pour la recherche séquentielle

interface Props {
  path: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const hx = (n: number): string => n.toString(16).padStart(2, "0");
const off8 = (n: number): string => n.toString(16).padStart(8, "0");

// Parse une requête en motif d'octets : hex ("DE AD BE" ou "deadbe") ou, si préfixe "ascii:", du texte.
function parseQuery(q: string): Uint8Array | null {
  const t = q.trim();
  if (!t) return null;
  if (t.toLowerCase().startsWith("ascii:")) {
    const s = t.slice(6);
    return new Uint8Array([...s].map((c) => c.charCodeAt(0) & 0xff));
  }
  const hex = t.replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function HexViewer({ path, onClose, onError }: Props): React.ReactElement {
  const [total, setTotal] = useState(0);
  const [win, setWin] = useState<{ offset: number; bytes: Uint8Array }>({ offset: 0, bytes: new Uint8Array() });
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(600);
  const [jump, setJump] = useState("");
  const [query, setQuery] = useState("");
  const [hit, setHit] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const loading = useRef(false);

  const loadWindow = useCallback(async (offset: number) => {
    if (loading.current) return;
    loading.current = true;
    try {
      const r = await readByteRange(path, Math.max(0, offset), WINDOW);
      setTotal(r.total);
      setWin({ offset: Math.max(0, offset), bytes: b64ToBytes(r.dataB64) });
    } catch (e) {
      onError(String(e));
    } finally {
      loading.current = false;
    }
  }, [path, onError]);

  useEffect(() => { loadWindow(0); }, [loadWindow]);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    setViewH(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const totalLines = Math.max(1, Math.ceil(total / ROW));
  const firstLine = Math.floor(scrollTop / LINE_H);
  const visLines = Math.ceil(viewH / LINE_H) + 4;

  // Recharge la fenêtre si la zone visible sort de ce qui est chargé.
  useEffect(() => {
    const need = firstLine * ROW;
    const end = need + visLines * ROW;
    if (need < win.offset || end > win.offset + win.bytes.length) {
      if (total === 0 || end <= total + ROW) loadWindow(Math.max(0, need - WINDOW / 4));
    }
  }, [firstLine, visLines, win, total, loadWindow]);

  const rows: React.ReactElement[] = [];
  const start = Math.max(0, firstLine);
  for (let line = start; line < Math.min(totalLines, start + visLines); line++) {
    const base = line * ROW;
    const idx = base - win.offset;
    if (idx < 0 || idx >= win.bytes.length) continue;
    const slice = win.bytes.subarray(idx, idx + ROW);
    const hexCells = [...slice].map((b) => hx(b)).join(" ");
    const ascii = [...slice].map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    const isHit = hit !== null && hit >= base && hit < base + ROW;
    rows.push(
      <div
        key={line}
        style={{ position: "absolute", top: line * LINE_H, height: LINE_H }}
        className={`flex gap-4 px-3 font-mono text-[12px] leading-[18px] whitespace-pre ${isHit ? "bg-[var(--color-accent)]/25" : ""}`}
      >
        <span className="text-[var(--color-text-dim)] select-none">{off8(base)}</span>
        <span className="text-[var(--color-text)]">{hexCells.padEnd(ROW * 3 - 1, " ")}</span>
        <span className="text-[var(--color-text-dim)]">{ascii}</span>
      </div>,
    );
  }

  const doJump = useCallback(() => {
    const t = jump.trim();
    const n = t.toLowerCase().startsWith("0x") ? parseInt(t, 16) : parseInt(t, t.match(/[a-f]/i) ? 16 : 10);
    if (Number.isNaN(n) || n < 0) return;
    const top = Math.floor(n / ROW) * LINE_H;
    scroller.current?.scrollTo({ top });
    setHit(n);
  }, [jump]);

  const doSearch = useCallback(async () => {
    const pat = parseQuery(query);
    if (!pat || pat.length === 0) return onError("Motif invalide (hex ou « ascii:texte »).");
    const from = (hit ?? -1) + 1;
    try {
      for (let off = Math.max(0, from); off < total; off += SCAN - pat.length) {
        const r = await readByteRange(path, off, SCAN);
        const buf = b64ToBytes(r.dataB64);
        for (let i = 0; i + pat.length <= buf.length; i++) {
          let ok = true;
          for (let j = 0; j < pat.length; j++) if (buf[i + j] !== pat[j]) { ok = false; break; }
          if (ok) {
            const at = off + i;
            setHit(at);
            scroller.current?.scrollTo({ top: Math.floor(at / ROW) * LINE_H - viewH / 2 });
            return;
          }
        }
        if (buf.length < SCAN) break;
      }
      onError("Motif non trouvé.");
    } catch (e) {
      onError(String(e));
    }
  }, [query, hit, total, path, onError, viewH]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg)]">
      <div className="flex items-center gap-2 h-10 px-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <span className="text-sm font-medium text-[var(--color-text)] truncate">{baseName(path)}</span>
        <span className="text-[11px] text-[var(--color-text-dim)] font-mono">{total.toLocaleString()} o</span>
        <div className="flex-1" />
        <input
          value={jump} onChange={(e) => setJump(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doJump()}
          placeholder="offset (0x…)" spellCheck={false}
          className="w-28 h-7 px-2 text-xs font-mono rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
        <input
          value={query} onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && doSearch()}
          placeholder="chercher: DE AD BE EF  ou  ascii:ELF" spellCheck={false}
          className="w-64 h-7 px-2 text-xs font-mono rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
        />
        <button onClick={doSearch} className="h-7 px-2.5 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium">Chercher</button>
        <button onClick={onClose} className="h-7 px-2.5 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]">Fermer</button>
      </div>
      <div ref={scroller} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)} className="flex-1 overflow-auto relative">
        <div style={{ height: totalLines * LINE_H, position: "relative" }}>{rows}</div>
      </div>
    </div>
  );
}
