// Visualiseur d'archives : liste le contenu, propose extraction ici ou vers un chemin choisi.
import { useEffect, useRef, useState } from "react";
import { listArchive, extractArchive } from "../services/fs";
import type { ArchiveEntry, DirEntry } from "../types";
import { FolderGlyph, DocGlyph } from "./FileIcon";

interface Props {
  entry: DirEntry;
  onError: (msg: string) => void;
  onNavigate: (path: string) => void;
}

function fmtSize(b: number): string {
  if (b === 0) return "—";
  if (b < 1024) return `${b} o`;
  if (b < 1048576) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1048576).toFixed(1)} Mo`;
}

function archiveStem(entryPath: string): string {
  const name = entryPath.split("/").pop() ?? "";
  const compounds = [".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst", ".tar"];
  for (const c of compounds) {
    if (name.toLowerCase().endsWith(c)) return name.slice(0, -c.length);
  }
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function parentDir(filePath: string): string {
  const slash = filePath.lastIndexOf("/");
  return slash > 0 ? filePath.slice(0, slash) : "/";
}

export function ArchiveViewer({ entry, onError, onNavigate }: Props) {
  const [items, setItems] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showPathInput, setShowPathInput] = useState(false);
  const [customPath, setCustomPath] = useState("");
  const pathRef = useRef<HTMLInputElement>(null);

  const extractHereDest = `${parentDir(entry.path)}/${archiveStem(entry.path)}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFilter("");
    setDone(null);
    setShowPathInput(false);
    listArchive(entry.path)
      .then((es) => alive && setItems(es))
      .catch((e) => alive && onError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [entry.path, onError]);

  useEffect(() => {
    if (showPathInput) {
      setCustomPath(extractHereDest);
      setTimeout(() => { pathRef.current?.focus(); pathRef.current?.select(); }, 50);
    }
  }, [showPathInput, extractHereDest]);

  const extract = async (dest: string) => {
    if (!dest.trim()) return;
    setExtracting(true);
    setDone(null);
    try {
      await extractArchive(entry.path, dest.trim());
      setDone(dest.trim());
      setShowPathInput(false);
    } catch (e) {
      onError(String(e));
    } finally {
      setExtracting(false);
    }
  };

  const q = filter.toLowerCase();
  const visible = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;
  const dirs = items.filter((i) => i.is_dir).length;
  const files = items.length - dirs;

  if (loading) return <Centered>Lecture de l'archive…</Centered>;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0 flex-wrap">
        <span className="text-[11px] text-[var(--color-text-dim)] shrink-0">
          {files} fichier{files !== 1 ? "s" : ""}
          {dirs > 0 && ` · ${dirs} dossier${dirs !== 1 ? "s" : ""}`}
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer…"
          className="w-36 h-6 px-2 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-dim)]"
        />
        <div className="flex-1" />
        <button
          onClick={() => extract(extractHereDest)}
          disabled={extracting}
          className="px-2.5 py-1 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium disabled:opacity-50 hover:opacity-90 transition-opacity shrink-0"
        >
          {extracting ? "Extraction…" : "Extraire ici"}
        </button>
        <button
          onClick={() => setShowPathInput((v) => !v)}
          disabled={extracting}
          className="px-2.5 py-1 text-xs rounded border border-[var(--color-border)] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:border-[var(--color-text-dim)] transition-colors disabled:opacity-50 shrink-0"
        >
          Choisir l'emplacement…
        </button>
      </div>

      {/* Path input pour emplacement personnalisé */}
      {showPathInput && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg)] shrink-0">
          <input
            ref={pathRef}
            value={customPath}
            onChange={(e) => setCustomPath(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") extract(customPath);
              if (e.key === "Escape") setShowPathInput(false);
            }}
            placeholder="Chemin de destination…"
            className="flex-1 h-7 px-2 text-xs rounded bg-[var(--color-surface)] border border-[var(--color-accent)] text-[var(--color-text)] outline-none font-mono"
          />
          <button
            onClick={() => extract(customPath)}
            disabled={extracting || !customPath.trim()}
            className="px-2.5 py-1 text-xs rounded bg-[var(--color-accent)] text-[var(--color-bg)] font-medium disabled:opacity-50"
          >
            Extraire
          </button>
          <button
            onClick={() => setShowPathInput(false)}
            className="px-2 py-1 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Succès */}
      {done && (
        <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-accent-dim)]/10 text-xs text-[var(--color-text)] shrink-0">
          <span className="flex-1">
            Extrait dans <span className="font-mono text-[var(--color-accent)]">{done}</span>
          </span>
          <button
            onClick={() => onNavigate(done)}
            className="px-2 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            Ouvrir le dossier
          </button>
          <button onClick={() => setDone(null)} className="text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            ✕
          </button>
        </div>
      )}

      {/* Liste */}
      <div className="flex-1 overflow-auto">
        {visible.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[var(--color-text-dim)]">
            {filter ? "Aucun élément ne correspond au filtre" : "Archive vide"}
          </div>
        ) : (
          <table className="text-xs border-collapse w-full">
            <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
              <tr>
                <th className="px-3 py-2 text-left text-[var(--color-text-dim)] font-medium border-b border-[var(--color-border)] w-full">Nom</th>
                <th className="px-3 py-2 text-right text-[var(--color-text-dim)] font-medium border-b border-[var(--color-border)] whitespace-nowrap">Taille</th>
                <th className="px-3 py-2 text-right text-[var(--color-text-dim)] font-medium border-b border-[var(--color-border)] whitespace-nowrap">Compressé</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((item, i) => (
                <ArchiveRow key={i} item={item} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ArchiveRow({ item }: { item: ArchiveEntry }) {
  const depth = (item.name.match(/\//g) ?? []).length;
  const label = item.name.split("/").pop() ?? item.name;
  return (
    <tr className="hover:bg-[var(--color-surface-hover)] even:bg-[var(--color-surface)]/20">
      <td className="px-3 py-1.5 border-b border-[var(--color-border)]/30">
        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 16 }}>
          <span className="shrink-0 opacity-70">
            {item.is_dir ? <FolderGlyph /> : <DocGlyph />}
          </span>
          <span className="truncate text-[var(--color-text)]">{label}</span>
        </div>
      </td>
      <td className="px-3 py-1.5 text-right text-[var(--color-text-dim)] border-b border-[var(--color-border)]/30 whitespace-nowrap font-mono">
        {fmtSize(item.size)}
      </td>
      <td className="px-3 py-1.5 text-right text-[var(--color-text-dim)] border-b border-[var(--color-border)]/30 whitespace-nowrap font-mono">
        {item.compressed_size > 0 && item.compressed_size !== item.size ? fmtSize(item.compressed_size) : "—"}
      </td>
    </tr>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]">{children}</div>;
}
