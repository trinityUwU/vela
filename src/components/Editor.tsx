// Mode Édition : éditeur central. Édite+sauve les petits fichiers, lit par chunks les volumineux.
import { useCallback, useEffect, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as fs from "../services/fs";
import { useFileContent } from "../hooks/useFileContent";
import { langExtension, previewKind } from "../services/file-kind";
import type { DirEntry } from "../types";
import { Save, Eye, Code } from "./icons";

interface Props {
  entry: DirEntry;
  onClose: () => void;
  onError: (msg: string) => void;
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1024 / 1024).toFixed(1)} Mo`;
}

export function Editor({ entry, onClose, onError }: Props) {
  const file = useFileContent(entry.path, entry.size, onError);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const isMd = previewKind(entry.extension) === "markdown";

  useEffect(() => {
    setDirty(false);
    setPreview(false);
  }, [entry.path]);

  const save = useCallback(async () => {
    if (!file.editable) return;
    try {
      await fs.writeFile(entry.path, file.content);
      setDirty(false);
    } catch (e) {
      onError(String(e));
    }
  }, [entry.path, file.content, file.editable, onError]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save]);

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-center gap-2 px-3 h-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <span className="text-sm text-[var(--color-text)] truncate">{entry.name}</span>
        {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" title="Non sauvegardé" />}
        <span className="text-[11px] text-[var(--color-text-dim)]">{fmtSize(entry.size)}</span>
        <div className="flex-1" />
        {file.editable && isMd && (
          <HBtn onClick={() => setPreview((v) => !v)} active={preview} title="Aperçu">
            {preview ? <Code /> : <Eye />}
          </HBtn>
        )}
        {file.editable && (
          <HBtn onClick={save} title="Sauvegarder (Ctrl+S)"><Save /></HBtn>
        )}
        <button
          onClick={onClose}
          className="px-2 py-1 text-xs rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        >
          Fermer
        </button>
      </div>

      {!file.editable && (
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-[11px] bg-[var(--color-accent-dim)]/20 border-b border-[var(--color-border)] text-[var(--color-text-dim)]">
          <span>
            Fichier volumineux — lecture seule · {fmtSize(file.offset)} / {fmtSize(file.totalSize)} chargés
          </span>
          {!file.eof && (
            <button
              onClick={file.loadMore}
              disabled={file.loading}
              className="px-2 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text)] disabled:opacity-50"
            >
              {file.loading ? "…" : "Charger la suite"}
            </button>
          )}
        </div>
      )}

      {file.loading && file.content === "" ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]">
          Chargement…
        </div>
      ) : preview ? (
        <div className="flex-1 overflow-y-auto p-6 prose-vela">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{file.content}</ReactMarkdown>
        </div>
      ) : (
        <CodeMirror
          value={file.content}
          height="100%"
          theme={vscodeDark}
          editable={file.editable}
          extensions={file.editable ? langExtension(entry.extension) : []}
          basicSetup={file.editable ? undefined : { foldGutter: false, highlightActiveLine: false }}
          onChange={(v) => {
            if (!file.editable) return;
            file.setContent(v);
            setDirty(true);
          }}
          className="flex-1 overflow-hidden text-sm"
        />
      )}
    </div>
  );
}

function HBtn({
  children, onClick, title, active,
}: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "text-[var(--color-accent)] bg-[var(--color-surface-hover)]"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {children}
    </button>
  );
}
