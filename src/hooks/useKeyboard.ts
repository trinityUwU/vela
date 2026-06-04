// Raccourcis clavier globaux. Désactivés quand le focus est dans un champ de saisie / éditeur.
import { useEffect } from "react";

export interface KeyHandlers {
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onSelectAll?: () => void;
  onTrash?: () => void;
  onDeletePermanent?: () => void;
  onRename?: () => void;
  onEscape?: () => void;
  onRefresh?: () => void;
  onFind?: () => void;
  onQuickLook?: () => void;
  onUndo?: () => void;
  onBack?: () => void;
  onForward?: () => void;
  onPalette?: () => void;
  onNewTab?: () => void;
  onCloseTab?: () => void;
  onNextTab?: () => void;
  onPrevTab?: () => void;
  onPaneCopy?: () => void;
  onPaneMove?: () => void;
  onSwitchPane?: () => void;
}

function inEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable || !!el.closest(".cm-editor");
}

export function useKeyboard(h: KeyHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        h.onEscape?.();
        return;
      }
      // Ctrl+K : disponible même depuis un champ/éditeur (avant le guard inEditable).
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); h.onPalette?.(); return; }
      if (inEditable(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;

      if (e.altKey && e.key === "ArrowLeft") { e.preventDefault(); h.onBack?.(); return; }
      if (e.altKey && e.key === "ArrowRight") { e.preventDefault(); h.onForward?.(); return; }

      if (mod && e.key === "Tab") { e.preventDefault(); if (e.shiftKey) h.onPrevTab?.(); else h.onNextTab?.(); return; }
      if (mod && e.key === "t") { e.preventDefault(); h.onNewTab?.(); return; }
      if (mod && e.key === "w") { e.preventDefault(); h.onCloseTab?.(); return; }
      // Volet jumeau : Tab bascule le volet actif, F6 déplace vers l'autre volet (F5 plus bas).
      if (e.key === "Tab" && !e.shiftKey && h.onSwitchPane) { e.preventDefault(); h.onSwitchPane(); return; }
      if (e.key === "F6" && h.onPaneMove) { e.preventDefault(); h.onPaneMove(); return; }

      if (mod && e.key === "c") { e.preventDefault(); h.onCopy?.(); return; }
      if (mod && e.key === "x") { e.preventDefault(); h.onCut?.(); return; }
      if (mod && e.key === "v") { e.preventDefault(); h.onPaste?.(); return; }
      if (mod && e.key === "z") { e.preventDefault(); h.onUndo?.(); return; }
      if (mod && e.key === "a") { e.preventDefault(); h.onSelectAll?.(); return; }
      if (mod && e.key === "f") { e.preventDefault(); h.onFind?.(); return; }
      if (e.key === " ") { e.preventDefault(); h.onQuickLook?.(); return; }
      if (e.key === "F2") { e.preventDefault(); h.onRename?.(); return; }
      if (e.key === "F5") { e.preventDefault(); if (h.onPaneCopy) h.onPaneCopy(); else h.onRefresh?.(); return; }
      if (e.key === "Delete") {
        e.preventDefault();
        if (e.shiftKey) h.onDeletePermanent?.();
        else h.onTrash?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h]);
}
