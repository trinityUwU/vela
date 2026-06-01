// Visualisation tabulaire : CSV/TSV (parse texte) et XLSX/XLS/ODS (SheetJS).
import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
import { readFile, readFileBase64 } from "../services/fs";
import type { DirEntry } from "../types";

interface Props {
  entry: DirEntry;
  onError: (msg: string) => void;
}

type TableData = { headers: string[]; rows: string[][] };

const CSV_EXTS = new Set(["csv", "tsv"]);
const XLSX_EXTS = new Set(["xlsx", "xls", "ods"]);

function parseCSV(text: string, sep: string): TableData {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const split = (l: string) => l.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
  const [first, ...rest] = lines;
  return { headers: split(first ?? ""), rows: rest.map(split) };
}

async function loadTable(entry: DirEntry): Promise<TableData> {
  if (CSV_EXTS.has(entry.extension)) {
    const text = await readFile(entry.path);
    const sep = entry.extension === "tsv" ? "\t" : detectSep(text);
    return parseCSV(text, sep);
  }
  const b64 = await readFileBase64(entry.path);
  const wb = XLSX.read(b64, { type: "base64" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as string[][];
  if (!rows.length) return { headers: [], rows: [] };
  const [headers, ...data] = rows;
  return { headers: headers.map(String), rows: data.map((r) => r.map(String)) };
}

function detectSep(text: string): string {
  const first = text.slice(0, 2000);
  const counts = { ";": 0, ",": 0, "\t": 0 };
  for (const ch of first) if (ch in counts) counts[ch as keyof typeof counts]++;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

export function TableViewer({ entry, onError }: Props) {
  const [data, setData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setFilter("");
    loadTable(entry)
      .then((d) => alive && setData(d))
      .catch((e) => alive && onError(String(e)))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [entry.path, onError]);

  if (loading) return <Centered>Chargement…</Centered>;
  if (!data || !data.headers.length) return <Centered>Tableau vide ou non lisible</Centered>;

  const q = filter.toLowerCase();
  const visible = q
    ? data.rows.filter((r) => r.some((c) => c.toLowerCase().includes(q)))
    : data.rows;

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="flex items-center gap-3 px-3 h-9 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <span className="text-[11px] text-[var(--color-text-dim)]">
          {data.headers.length} colonnes · {data.rows.length} lignes
          {XLSX_EXTS.has(entry.extension) && <span className="ml-2 opacity-60">feuille 1</span>}
        </span>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrer…"
          className="ml-auto w-44 h-6 px-2 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-dim)]"
        />
        {filter && (
          <span className="text-[11px] text-[var(--color-text-dim)]">{visible.length} résultat{visible.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        <table className="text-xs border-collapse min-w-full">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface)]">
            <tr>
              <th className="w-10 px-2 py-2 text-right text-[var(--color-text-dim)] border-b border-r border-[var(--color-border)] font-normal select-none">#</th>
              {data.headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left text-[var(--color-text)] font-semibold border-b border-r border-[var(--color-border)] whitespace-nowrap">
                  {h || <span className="opacity-40">col {i + 1}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, ri) => (
              <tr key={ri} className="hover:bg-[var(--color-surface-hover)] even:bg-[var(--color-surface)]/30">
                <td className="px-2 py-1.5 text-right text-[var(--color-text-dim)] border-r border-[var(--color-border)] select-none">{ri + 1}</td>
                {data.headers.map((_, ci) => (
                  <td key={ci} className="px-3 py-1.5 border-r border-[var(--color-border)]/50 whitespace-nowrap max-w-xs truncate text-[var(--color-text)]">
                    {row[ci] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <div className="px-4 py-6 text-sm text-[var(--color-text-dim)]">Aucune ligne ne correspond au filtre</div>
        )}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]">{children}</div>;
}
