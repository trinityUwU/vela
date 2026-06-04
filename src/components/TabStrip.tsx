// Barre d'onglets de dossiers : un onglet par navigation isolée. Affichée seulement à partir de 2 onglets.
// Clic droit → menu (renommer / fermer / pastille de couleur). Double-clic → renommage inline.
import { useState } from "react";
import type { FolderTab } from "../hooks/useFileManager";
import { baseName } from "../services/path-util";
import { TAG_COLORS, hexFor } from "../services/tags";
import { FloatingMenu } from "./FloatingMenu";

interface Props {
  tabs: FolderTab[];
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, name: string) => void;
  onSetColor: (id: string, color: string) => void;
}

type TabMenu = { id: string; x: number; y: number } | null;

export function TabStrip({ tabs, activeId, onSelect, onClose, onNew, onRename, onSetColor }: Props): React.ReactElement | null {
  const [menu, setMenu] = useState<TabMenu>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  if (tabs.length <= 1) return null;

  return (
    <div className="flex items-stretch h-8 shrink-0 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
      {tabs.map((t) => {
        const active = t.id === activeId;
        const cls = active
          ? "bg-[var(--color-bg)] text-[var(--color-text)] border-t-[var(--color-accent)]"
          : "border-t-transparent text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]";
        return (
          <div
            key={t.id}
            onClick={() => onSelect(t.id)}
            onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); onClose(t.id); } }}
            onContextMenu={(e) => { e.preventDefault(); setMenu({ id: t.id, x: e.clientX, y: e.clientY }); }}
            onDoubleClick={() => setRenaming(t.id)}
            title={t.cwd}
            className={`group flex items-center gap-2 pl-3 pr-2 max-w-44 min-w-24 cursor-pointer border-r border-[var(--color-border)] border-t-2 text-xs ${cls}`}
          >
            {t.color && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hexFor(t.color) }} />}
            {renaming === t.id ? (
              <input
                autoFocus
                defaultValue={t.name ?? baseName(t.cwd)}
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { onRename(t.id, e.target.value); setRenaming(null); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { onRename(t.id, (e.target as HTMLInputElement).value); setRenaming(null); }
                  if (e.key === "Escape") setRenaming(null);
                }}
                className="w-24 flex-1 bg-[var(--color-bg)] border border-[var(--color-accent)] rounded px-1 text-xs text-[var(--color-text)] outline-none"
              />
            ) : (
              <span className="truncate flex-1">{t.name ?? baseName(t.cwd) ?? "/"}</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
              className="shrink-0 w-4 h-4 rounded flex items-center justify-center text-[var(--color-text-dim)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
              title="Fermer l'onglet"
            >
              ✕
            </button>
          </div>
        );
      })}
      <button
        onClick={onNew}
        className="shrink-0 w-8 flex items-center justify-center text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
        title="Nouvel onglet (Ctrl+T)"
      >
        +
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} onContextMenu={(e) => { e.preventDefault(); setMenu(null); }} />
          <FloatingMenu x={menu.x} y={menu.y} className="min-w-44">
            <MenuItem label="Renommer" onClick={() => { setRenaming(menu.id); setMenu(null); }} />
            <MenuItem label="Fermer l'onglet" onClick={() => { onClose(menu.id); setMenu(null); }} />
            <div className="my-1 border-t border-[var(--color-border)]" />
            <div className="flex items-center gap-1.5 px-3 py-1.5">
              {TAG_COLORS.map((c) => (
                <button
                  key={c.key}
                  title={c.label}
                  onClick={() => { onSetColor(menu.id, c.key); setMenu(null); }}
                  style={{ backgroundColor: c.hex }}
                  className="w-4 h-4 rounded-full transition-transform hover:scale-110"
                />
              ))}
              <button
                title="Retirer la couleur"
                onClick={() => { onSetColor(menu.id, ""); setMenu(null); }}
                className="w-4 h-4 rounded-full border border-[var(--color-border)] text-[var(--color-text-dim)] text-[10px] leading-none flex items-center justify-center hover:text-[var(--color-text)]"
              >
                ✕
              </button>
            </div>
          </FloatingMenu>
        </>
      )}
    </div>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
    >
      {label}
    </button>
  );
}
