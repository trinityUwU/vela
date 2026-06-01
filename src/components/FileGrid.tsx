// Zone centrale en mode navigation : grille des entrées du dossier courant.
import { useEffect, useRef } from "react";
import type { DirEntry } from "../types";
import { FileTile } from "./FileTile";
import { onTileKey } from "./tile-keys";

interface Props {
  entries: DirEntry[];
  selection: Set<string>;
  active: string | null;
  onSelect: (entry: DirEntry, e: React.MouseEvent) => void;
  onOpen: (entry: DirEntry) => void;
  onActivate: () => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
  onContextBg: (e: React.MouseEvent) => void;
  onClearBg: () => void;
  onMove: (src: string, destDir: string) => void;
  onArrow: (delta: number, axis: "x" | "y") => void;
  onColumns?: (cols: number) => void;
  colorOf: (path: string) => string | undefined;
}

export function FileGrid({ entries, selection, active, onSelect, onOpen, onActivate, onContext, onContextBg, onClearBg, onMove, onArrow, onColumns, colorOf }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const handleBg = (e: React.MouseEvent) => {
    e.preventDefault();
    onContextBg(e);
  };

  useEffect(() => { scrollRef.current?.focus({ preventScroll: true }); }, [entries]);

  useEffect(() => {
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap || !onColumns) return;
      const tiles = wrap.children;
      if (tiles.length === 0) return;
      const top = (tiles[0] as HTMLElement).offsetTop;
      let cols = 0;
      for (const t of tiles) {
        if ((t as HTMLElement).offsetTop !== top) break;
        cols++;
      }
      onColumns(Math.max(1, cols));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [entries, onColumns]);

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]" onContextMenu={handleBg}>
        Dossier vide
      </div>
    );
  }
  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      className="flex-1 overflow-y-auto p-3 outline-none"
      onContextMenu={handleBg}
      onKeyDown={(e) => onTileKey(e, onActivate, onArrow)}
      onClick={(e) => { if (e.target === e.currentTarget) onClearBg(); }}
    >
      <div
        ref={wrapRef}
        className="flex flex-wrap gap-1 content-start"
        onClick={(e) => { if (e.target === e.currentTarget) onClearBg(); }}
      >
        {entries.map((e) => (
          <FileTile
            key={e.path}
            entry={e}
            selected={selection.has(e.path)}
            active={active === e.path}
            color={colorOf(e.path)}
            onClick={(ev) => onSelect(e, ev)}
            onDouble={() => onOpen(e)}
            onContext={(ev) => onContext(ev, e)}
            onMove={onMove}
          />
        ))}
      </div>
    </div>
  );
}
