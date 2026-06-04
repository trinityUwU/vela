// Menu contextuel au clic droit sur une entrée (fichier ou dossier), mono ou multi-sélection.
import { useEffect, useRef, useState } from "react";
import { useMenuPosition } from "../hooks/useMenuPosition";
import { previewKind } from "../services/file-kind";
import { convertTargets } from "../services/convert";
import { smartActions } from "../services/smart-actions";
import type { SmartActionId } from "../services/smart-actions";
import type { DirEntry } from "../types";
import { TAG_COLORS } from "../services/tags";

export interface MenuState {
  x: number;
  y: number;
  path: string;
  name: string;
  isDir: boolean;
  extension: string;
  cwd: string;
  count: number;
}

interface Props {
  menu: MenuState;
  onClose: () => void;
  onOpen: () => void;
  onOpenNewTab?: () => void;
  onOpenNative?: () => void;
  onRename: () => void;
  onTrash: () => void;
  onDeletePermanent: () => void;
  onProperties: () => void;
  onCopy: () => void;
  onCut: () => void;
  onCompress: () => void;
  onBatchRename: () => void;
  onCompare: () => void;
  onSetColor: (color: string) => void;
  currentColor?: string;
  onOpenTerminal?: () => void;
  onComputeSize?: () => void;
  onAnalyze?: () => void;
  onHash?: () => void;
  onHexView?: () => void;
  onMediaTools?: () => void;
  onExtractHere?: () => void;
  onExtractTo?: () => void;
  onConvert?: (target: string) => void;
  onOcr?: () => void;
  onTranslate?: () => void;
  entries?: DirEntry[];
  onSmartAction?: (id: SmartActionId) => void;
  onSaveTemplate?: () => void;
  onShare?: () => void;
  onPdfTools?: () => void;
}

function relativePath(path: string, cwd: string): string {
  const base = cwd.endsWith("/") ? cwd : cwd + "/";
  return path.startsWith(base) ? path.slice(base.length) : path.split("/").pop() ?? path;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

export function ContextMenu(props: Props) {
  const { menu, onClose, onOpen, onRename, onTrash, onDeletePermanent, onProperties } = props;
  const { onCopy, onCut, onCompress, onBatchRename, onCompare, onSetColor, onOpenTerminal, onComputeSize, onAnalyze, onMediaTools, onExtractHere, onExtractTo, onConvert, onOpenNative } = props;

  const { ref, style: menuStyle } = useMenuPosition(menu.x, menu.y);

  useEffect(() => {
    window.addEventListener("click", onClose);
    return () => window.removeEventListener("click", onClose);
  }, [onClose]);

  const multi = menu.count > 1;
  const rel = relativePath(menu.path, menu.cwd);
  const smart = props.onSmartAction ? smartActions(props.entries ?? []) : [];
  const isArchive = !multi && !menu.isDir && previewKind(menu.extension) === "archive";
  const allPdf = (props.entries ?? []).length > 0 && (props.entries ?? []).every((e) => !e.is_dir && e.extension.toLowerCase() === "pdf");
  const isPdf = !menu.isDir && (multi ? allPdf : menu.extension.toLowerCase() === "pdf");
  const mediaKind = !multi && !menu.isDir ? previewKind(menu.extension) : "binary";
  const isMedia = mediaKind === "image" || mediaKind === "audio" || mediaKind === "video";
  const isOcrable = mediaKind === "image" || mediaKind === "pdf";
  const isTextable = mediaKind === "code" || mediaKind === "markdown" || mediaKind === "table";
  const mediaLabel =
    mediaKind === "image" ? "Éditer l'image…" : mediaKind === "audio" ? "Outils audio…" : "Outils vidéo…";

  return (
    <div
      ref={ref}
      style={{ top: menuStyle.top, left: menuStyle.left, maxHeight: menuStyle.maxHeight }}
      className="fixed z-50 min-w-52 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-y-auto"
    >
      {multi && (
        <div className="px-3 py-1 text-xs text-[var(--color-text-dim)]">{menu.count} éléments</div>
      )}
      {smart.length > 0 && (
        <>
          {smart.map((a) => (
            <Item key={a.id} label={a.label} onClick={() => { props.onSmartAction?.(a.id); onClose(); }} />
          ))}
          <Divider />
        </>
      )}
      {!multi && <Item label="Ouvrir" onClick={onOpen} />}
      {!multi && menu.isDir && props.onOpenNewTab && (
        <Item label="Ouvrir dans un nouvel onglet" onClick={() => { props.onOpenNewTab?.(); onClose(); }} />
      )}
      {!multi && !menu.isDir && onOpenNative && (
        <Item label="Ouvrir dans l'app par défaut" onClick={() => { onOpenNative(); onClose(); }} />
      )}
      {isMedia && onMediaTools && (
        <Item label={mediaLabel} onClick={() => { onMediaTools(); onClose(); }} />
      )}
      {!multi && menu.isDir && onOpenTerminal && (
        <Item label="Ouvrir un terminal ici" onClick={() => { onOpenTerminal(); onClose(); }} />
      )}
      {!multi && menu.isDir && onComputeSize && (
        <Item label="Calculer la taille" onClick={() => { onComputeSize(); onClose(); }} />
      )}
      {!multi && menu.isDir && onAnalyze && (
        <Item label="Analyser l'espace…" onClick={() => { onAnalyze(); onClose(); }} />
      )}
      {isArchive && (
        <>
          <Divider />
          <Item label="Extraire ici" onClick={() => { onExtractHere?.(); onClose(); }} />
          <Item label="Extraire vers…" onClick={() => { onExtractTo?.(); onClose(); }} />
        </>
      )}
      {isPdf && props.onPdfTools && (
        <Item label={multi ? "Outils PDF (fusionner)…" : "Outils PDF…"} onClick={() => { props.onPdfTools?.(); onClose(); }} />
      )}
      {isOcrable && props.onOcr && (
        <Item label="Extraire le texte (OCR)" onClick={() => { props.onOcr?.(); onClose(); }} />
      )}
      {isTextable && props.onTranslate && (
        <Item label="Traduire…" onClick={() => { props.onTranslate?.(); onClose(); }} />
      )}
      {!multi && !menu.isDir && onConvert && (
        <ConvertSubmenu path={menu.path} onConvert={(t) => { onConvert(t); onClose(); }} />
      )}
      {!multi && !menu.isDir && props.onHash && (
        <Item label="Empreinte (hash)…" onClick={() => { props.onHash?.(); onClose(); }} />
      )}
      {!multi && !menu.isDir && props.onHexView && (
        <Item label="Ouvrir en hexadécimal" onClick={() => { props.onHexView?.(); onClose(); }} />
      )}
      <Divider />
      <Item label="Copier" onClick={() => { onCopy(); onClose(); }} />
      <Item label="Couper" onClick={() => { onCut(); onClose(); }} />
      <Item label="Compresser…" onClick={() => { onCompress(); onClose(); }} />
      {props.onShare && <Item label="Partager sur le réseau local…" onClick={() => { props.onShare?.(); onClose(); }} />}
      <Divider />
      {!multi && (
        <>
          <Item label="Copier le chemin" onClick={() => { copyToClipboard(menu.path); onClose(); }} />
          <Item label={`Copier le chemin relatif  — ${rel}`} onClick={() => { copyToClipboard(rel); onClose(); }} dim />
          <Divider />
          <Item label="Renommer" onClick={onRename} />
        </>
      )}
      {menu.count === 2 && <Item label="Comparer les 2 éléments" onClick={() => { onCompare(); onClose(); }} />}
      {multi && <Item label="Renommer par lot…" onClick={onBatchRename} />}
      {!multi && props.onSaveTemplate && (
        <Item label="Enregistrer comme modèle…" onClick={() => { props.onSaveTemplate?.(); onClose(); }} />
      )}
      <Divider />
      <div className="flex items-center gap-1.5 px-3 py-1.5">
        {TAG_COLORS.map((c) => (
          <button
            key={c.key}
            title={c.label}
            onClick={() => { onSetColor(c.key); onClose(); }}
            style={{ backgroundColor: c.hex }}
            className={`w-4 h-4 rounded-full transition-transform hover:scale-110 ${
              props.currentColor === c.key ? "ring-2 ring-[var(--color-text)] ring-offset-1 ring-offset-[var(--color-surface)]" : ""
            }`}
          />
        ))}
        <button
          title="Retirer la couleur"
          onClick={() => { onSetColor(""); onClose(); }}
          className="w-4 h-4 rounded-full border border-[var(--color-border)] text-[var(--color-text-dim)] text-[10px] leading-none flex items-center justify-center hover:text-[var(--color-text)]"
        >
          ✕
        </button>
      </div>
      <Divider />
      <Item label="Mettre à la corbeille" onClick={onTrash} />
      <Item label="Supprimer définitivement" onClick={onDeletePermanent} danger />
      {!multi && (
        <>
          <Divider />
          <Item label="Propriétés" onClick={onProperties} />
        </>
      )}
    </div>
  );
}

// Sous-menu en position fixe (hors du conteneur scrollé du menu parent, sinon clipping horizontal).
function ConvertSubmenu({ path, onConvert }: { path: string; onConvert: (target: string) => void }) {
  const [targets, setTargets] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; maxHeight: number }>({ left: 0, top: 0, maxHeight: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { convertTargets(path).then(setTargets).catch(() => setTargets([])); }, [path]);
  if (targets.length === 0) return null;

  const SUB_W = 144;
  const openSub = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return setOpen(true);
    const left = r.right + SUB_W > window.innerWidth ? r.left - SUB_W : r.right;
    const top = Math.min(r.top, window.innerHeight - 80);
    setPos({ left, top, maxHeight: window.innerHeight - top - 8 });
    setOpen(true);
  };

  return (
    <div onMouseEnter={openSub} onMouseLeave={() => setOpen(false)}>
      <button
        ref={btnRef}
        className="w-full flex items-center justify-between px-3 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
      >
        <span>Convertir vers</span>
        <span className="text-[var(--color-text-dim)]">›</span>
      </button>
      {open && (
        <div
          style={{ left: pos.left, top: pos.top, maxHeight: pos.maxHeight, width: SUB_W }}
          className="fixed z-[60] overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl py-1"
        >
          {targets.map((t) => (
            <button
              key={t}
              onClick={() => onConvert(t)}
              className="w-full text-left px-3 py-1.5 text-sm uppercase text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Item({ label, onClick, danger, dim }: {
  label: string; onClick: () => void; danger?: boolean; dim?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-hover)] truncate ${
        danger ? "text-[var(--color-danger)]" : dim ? "text-[var(--color-text-dim)]" : "text-[var(--color-text)]"
      }`}
    >
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-[var(--color-border)]" />;
}
