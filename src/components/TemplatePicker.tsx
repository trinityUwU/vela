// Sélecteur de modèle (F24) : liste les modèles de ~/.config/vela/templates/ et en instancie un dans le cwd.
import { useEffect, useState } from "react";
import { templateList, type Template } from "../services/templates";
import { FolderGlyph, DocGlyph } from "./FileIcon";

interface Props {
  onPick: (name: string) => void;
  onClose: () => void;
}

export function TemplatePicker({ onPick, onClose }: Props): React.ReactElement {
  const [templates, setTemplates] = useState<Template[] | null>(null);

  useEffect(() => {
    templateList().then(setTemplates).catch(() => setTemplates([]));
  }, []);

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(440px,92vw)] max-h-[70vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-medium text-[var(--color-text)]">Nouveau depuis modèle</h2>
          <p className="text-[11px] text-[var(--color-text-dim)] mt-0.5">~/.config/vela/templates/</p>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {templates === null && <div className="px-3 py-4 text-xs text-[var(--color-text-dim)]">Chargement…</div>}
          {templates?.length === 0 && (
            <div className="px-3 py-4 text-xs text-[var(--color-text-dim)]">
              Aucun modèle. Clic droit sur un fichier/dossier → « Enregistrer comme modèle ».
            </div>
          )}
          {templates?.map((t) => (
            <button
              key={t.name}
              onClick={() => { onPick(t.name); onClose(); }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] text-left"
            >
              <span className="opacity-70">{t.is_dir ? <FolderGlyph /> : <DocGlyph />}</span>
              <span className="truncate">{t.name}</span>
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-[var(--color-border)] flex justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
