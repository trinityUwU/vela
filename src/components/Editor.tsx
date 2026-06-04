// Mode Édition : éditeur central. Édite+sauve les petits fichiers, lit par chunks les volumineux.
import { useCallback, useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { search, openSearchPanel, closeSearchPanel } from "@codemirror/search";
import type { EditorView } from "@codemirror/view";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import * as fs from "../services/fs";
import { useFileContent } from "../hooks/useFileContent";
import { langExtension, previewKind } from "../services/file-kind";
import type { DirEntry } from "../types";
import { Save, Eye, Code, Search, Sliders } from "./icons";
import { TableViewer } from "./TableViewer";
import { ArchiveViewer } from "./ArchiveViewer";
import { PdfViewer } from "./PdfViewer";
import { MediaViewer } from "./MediaViewer";
import { MediaToolsModal } from "./MediaToolsModal";

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  bmp: "image/bmp", ico: "image/x-icon",
};

interface Props {
  entry: DirEntry;
  onClose: () => void;
  onError: (msg: string) => void;
  active?: boolean;
  editPath?: string | null;
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} o`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} Ko`;
  return `${(b / 1024 / 1024).toFixed(1)} Mo`;
}

export function Editor({ entry, onClose, onError, active = true, editPath = null }: Props) {
  const kind = previewKind(entry.extension);
  const isMd = kind === "markdown";
  const isTable = kind === "table";
  const isImage = kind === "image";
  const isArchive = kind === "archive";
  const isPdf = kind === "pdf";
  const isVideo = kind === "video";
  const isAudio = kind === "audio";
  const isMedia = isVideo || isAudio;
  const isHtml = entry.extension === "html" || entry.extension === "htm";
  const file = useFileContent(entry.path, entry.size, onError, isImage || isArchive || isPdf || isMedia, entry.modified);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [searchOn, setSearchOn] = useState(false);
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const viewRef = useRef<EditorView | null>(null);
  const canEdit = isImage || isMedia;

  useEffect(() => {
    setDirty(false);
    setPreview(false);
    setSearchOn(false);
    setImgSrc(null);
    setEditing(false);
  }, [entry.path]);

  // Ouverture via « Outils… » du menu contextuel : active directement le HUD d'édition.
  useEffect(() => {
    if (canEdit && editPath === entry.path) setEditing(true);
  }, [canEdit, editPath, entry.path]);

  useEffect(() => {
    if (!isImage) return;
    const mime = MIME[entry.extension] ?? "image/png";
    fs.readFileBase64(entry.path)
      .then((b64) => setImgSrc(`data:${mime};base64,${b64}`))
      .catch((e) => onError(String(e)));
  }, [entry.path, isImage, entry.extension, onError]);

  const toggleSearch = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    if (searchOn) {
      closeSearchPanel(view);
      setSearchOn(false);
    } else {
      openSearchPanel(view);
      setSearchOn(true);
    }
  }, [searchOn]);

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
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); save(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "f") { e.preventDefault(); toggleSearch(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, save, toggleSearch]);

  return (
    <div className="flex-1 flex flex-col min-w-0 relative">
      <div className="flex items-center gap-2 px-3 h-10 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <span className="text-sm text-[var(--color-text)] truncate">{entry.name}</span>
        {dirty && <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]" title="Non sauvegardé" />}
        <span className="text-[11px] text-[var(--color-text-dim)]">{fmtSize(entry.size)}</span>
        <div className="flex-1" />
        {canEdit && (
          <HBtn onClick={() => setEditing((v) => !v)} active={editing} title="Outils d'édition">
            <Sliders />
          </HBtn>
        )}
        {!preview && !isTable && !isImage && !isArchive && !isPdf && !isMedia && (
          <HBtn onClick={toggleSearch} active={searchOn} title="Rechercher dans le fichier (Ctrl+F)">
            <Search />
          </HBtn>
        )}
        {file.editable && (isMd || isHtml) && (
          <HBtn onClick={() => setPreview((v) => !v)} active={preview} title="Aperçu">
            {preview ? <Code /> : <Eye />}
          </HBtn>
        )}
        {file.editable && !isTable && !isImage && !isArchive && (
          <HBtn onClick={save} title="Sauvegarder (Ctrl+S)"><Save /></HBtn>
        )}
        <button
          onClick={onClose}
          className="px-2 py-1 text-xs rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        >
          Fermer
        </button>
      </div>

      {!file.editable && !isImage && !isArchive && !isPdf && !isMedia && (
        <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-[11px] bg-[var(--color-accent-dim)]/20 border-b border-[var(--color-border)] text-[var(--color-text-dim)]">
          <span>Fichier volumineux — lecture seule · {fmtSize(file.offset)} / {fmtSize(file.totalSize)} chargés</span>
          {!file.eof && (
            <button onClick={file.loadMore} disabled={file.loading}
              className="px-2 py-0.5 rounded bg-[var(--color-surface-hover)] text-[var(--color-text)] disabled:opacity-50">
              {file.loading ? "…" : "Charger la suite"}
            </button>
          )}
        </div>
      )}

      {isMedia ? (
        <MediaViewer entry={entry} kind={isVideo ? "video" : "audio"} active={active} />
      ) : isPdf ? (
        <PdfViewer entry={entry} onError={onError} />
      ) : isArchive ? (
        <ArchiveViewer entry={entry} onError={onError} />
      ) : isImage ? (
        <div className="flex-1 flex items-center justify-center overflow-auto p-4 bg-[var(--color-bg)]">
          {imgSrc ? (
            <img
              src={imgSrc}
              alt={entry.name}
              className="max-w-full max-h-full object-contain rounded"
              style={{ imageRendering: entry.extension === "svg" ? "auto" : "auto" }}
            />
          ) : (
            <span className="text-sm text-[var(--color-text-dim)]">Chargement…</span>
          )}
        </div>
      ) : isTable ? (
        <TableViewer entry={entry} onError={onError} />
      ) : file.loading && file.content === "" ? (
        <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]">
          Chargement…
        </div>
      ) : preview && isHtml ? (
        <iframe
          title={entry.name}
          srcDoc={file.content}
          sandbox=""
          className="flex-1 w-full bg-white border-0"
        />
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
          extensions={[
            search({ top: true }),
            ...(file.editable ? langExtension(entry.extension) : []),
          ]}
          basicSetup={file.editable
            ? undefined
            : { foldGutter: false, highlightActiveLine: false }
          }
          onCreateEditor={(view) => { viewRef.current = view; }}
          onChange={(v) => {
            if (!file.editable) return;
            file.setContent(v);
            setDirty(true);
          }}
          className="flex-1 overflow-hidden text-sm"
        />
      )}

      {editing && canEdit && (
        <div className="absolute bottom-3 right-3 z-40 w-[min(38rem,calc(100%-1.5rem))] max-h-[78%] overflow-y-auto rounded-lg">
          <MediaToolsModal
            path={entry.path}
            ext={entry.extension}
            embedded
            onClose={() => setEditing(false)}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}

function HBtn({ children, onClick, title, active }: {
  children: React.ReactNode; onClick: () => void; title: string; active?: boolean;
}) {
  return (
    <button onClick={onClick} title={title}
      className={`p-1.5 rounded-md transition-colors ${
        active
          ? "text-[var(--color-accent)] bg-[var(--color-surface-hover)]"
          : "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      }`}>
      {children}
    </button>
  );
}
