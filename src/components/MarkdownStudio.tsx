// Markdown studio (F13) : édition + preview live côte à côte (3 modes), table des matières, statistiques,
// export PDF/HTML via la conversion existante (typst/pandoc). Scroll TOC → saut à la ligne.
import { useCallback, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import type { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { langExtension } from "../services/file-kind";
import { buildToc, mdStats } from "../services/markdown-util";
import { convertFile } from "../services/convert";
import { baseName } from "../services/path-util";

type Mode = "code" | "split" | "preview";

interface Props {
  path: string;
  content: string;
  onChange: (v: string) => void;
  onError: (msg: string) => void;
}

export function MarkdownStudio({ path, content, onChange, onError }: Props): React.ReactElement {
  const [mode, setMode] = useState<Mode>("split");
  const [showToc, setShowToc] = useState(false);
  const viewRef = useRef<EditorView | null>(null);
  const toc = useMemo(() => buildToc(content), [content]);
  const stats = useMemo(() => mdStats(content), [content]);

  const jumpTo = useCallback((line: number) => {
    const view = viewRef.current;
    if (!view) return;
    const l = view.state.doc.line(Math.min(line + 1, view.state.doc.lines));
    view.dispatch({ selection: EditorSelection.cursor(l.from), scrollIntoView: true });
    view.focus();
  }, []);

  const exportAs = useCallback((target: "pdf" | "html") => {
    convertFile(path, target)
      .then(() => onError(`Exporté en ${target.toUpperCase()}.`))
      .catch((e) => {
        const msg = String(e);
        onError(msg.includes("PDF_ENGINE_MISSING") || msg.includes("pandoc introuvable")
          ? "Export PDF : pandoc + typst requis. Relance ./install.sh (auto-installés)."
          : msg);
      });
  }, [path, onError]);

  const editor = (
    <CodeMirror
      value={content}
      height="100%"
      theme={vscodeDark}
      extensions={langExtension("md")}
      onCreateEditor={(v) => { viewRef.current = v; }}
      onChange={onChange}
      className="h-full overflow-hidden text-sm"
    />
  );
  const rendered = (
    <div className="h-full overflow-y-auto p-6 prose-vela">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-3 h-8 border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] shrink-0">
        <div className="flex items-center gap-0.5">
          {(["code", "split", "preview"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-2 py-0.5 rounded ${mode === m ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"}`}>
              {m === "code" ? "Code" : m === "split" ? "Split" : "Aperçu"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowToc((v) => !v)} disabled={!toc.length}
          className={`px-2 py-0.5 rounded ${showToc ? "text-[var(--color-accent)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"} disabled:opacity-40`}>
          Sommaire
        </button>
        <div className="flex-1" />
        <span className="text-[var(--color-text-dim)]">{stats.words} mots · {stats.chars} car. · {stats.readMin} min</span>
        <button onClick={() => exportAs("html")} className="px-2 py-0.5 rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">→ HTML</button>
        <button onClick={() => exportAs("pdf")} className="px-2 py-0.5 rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">→ PDF</button>
      </div>

      <div className="flex-1 flex min-h-0">
        {showToc && toc.length > 0 && (
          <div className="w-56 shrink-0 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg)] py-2">
            {toc.map((t, i) => (
              <button key={i} onClick={() => jumpTo(t.line)} style={{ paddingLeft: 8 + (t.level - 1) * 12 }}
                className="w-full text-left pr-2 py-1 text-[11px] text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] truncate">
                {t.text}
              </button>
            ))}
          </div>
        )}
        {mode === "code" && <div className="flex-1 min-w-0">{editor}</div>}
        {mode === "preview" && <div className="flex-1 min-w-0">{rendered}</div>}
        {mode === "split" && (
          <>
            <div className="flex-1 min-w-0 border-r border-[var(--color-border)]">{editor}</div>
            <div className="flex-1 min-w-0">{rendered}</div>
          </>
        )}
      </div>
      <div className="px-3 py-0.5 text-[10px] text-[var(--color-text-dim)] border-t border-[var(--color-border)] bg-[var(--color-surface)] truncate shrink-0">
        {baseName(path)}
      </div>
    </div>
  );
}
