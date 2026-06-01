// Comparaison de deux fichiers côte à côte (CodeMirror MergeView, lecture seule).
import { useEffect, useRef } from "react";
import { MergeView } from "@codemirror/merge";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import * as fs from "../services/fs";
import { langExtension } from "../services/file-kind";
import type { DirEntry } from "../types";

interface Props {
  a: DirEntry;
  b: DirEntry;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function DiffViewer({ a, b, onClose, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  useEffect(() => {
    let view: MergeView | null = null;
    let cancelled = false;
    const common = [EditorView.editable.of(false), EditorState.readOnly.of(true), vscodeDark, EditorView.lineWrapping];
    Promise.all([fs.readFile(a.path), fs.readFile(b.path)])
      .then(([da, db]) => {
        if (cancelled || !ref.current) return;
        view = new MergeView({
          a: { doc: da, extensions: [...common, ...langExtension(a.extension)] },
          b: { doc: db, extensions: [...common, ...langExtension(b.extension)] },
          parent: ref.current,
          gutter: true,
        });
      })
      .catch((e) => onError(String(e)));
    return () => { cancelled = true; view?.destroy(); };
  }, [a.path, b.path, a.extension, b.extension, onError]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/70" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="m-auto w-[min(1200px,94vw)] h-[88vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center h-11 px-4 border-b border-[var(--color-border)] shrink-0 text-sm">
          <span className="flex-1 truncate text-[var(--color-text)]">{a.name}</span>
          <span className="px-3 text-[var(--color-text-dim)]">↔</span>
          <span className="flex-1 truncate text-right text-[var(--color-text)]">{b.name}</span>
          <button onClick={onClose} className="ml-4 px-2 py-1 text-xs rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            Fermer
          </button>
        </div>
        <div ref={ref} className="flex-1 min-h-0 overflow-auto text-sm" />
      </div>
    </div>
  );
}
