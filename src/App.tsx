// Assemblage du gestionnaire : topbar, sidebar, zone centrale (grille ou éditeur), modals.
import { useState } from "react";
import { useFileManager } from "./hooks/useFileManager";
import { Topbar } from "./components/Topbar";
import { Sidebar } from "./components/Sidebar";
import { FileGrid } from "./components/FileGrid";
import { FileList } from "./components/FileList";
import { Editor } from "./components/Editor";
import { ContextMenu } from "./components/ContextMenu";
import { InputModal } from "./components/InputModal";
import { ConfirmModal } from "./components/ConfirmModal";
import type { DirEntry } from "./types";

type Menu = { x: number; y: number; entry: DirEntry } | null;
type Dialog =
  | { kind: "rename"; entry: DirEntry }
  | { kind: "newfolder" }
  | { kind: "delete"; entry: DirEntry }
  | null;

export default function App() {
  const fm = useFileManager();
  const [menu, setMenu] = useState<Menu>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const onContext = (e: React.MouseEvent, entry: DirEntry) => {
    e.preventDefault();
    fm.setSelected(entry.path);
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };

  return (
    <div className="h-full flex flex-col">
      <Topbar
        mode={fm.mode}
        onMode={fm.setMode}
        path={fm.cwd}
        showHidden={fm.showHidden}
        onUp={fm.goUp}
        onRefresh={fm.refresh}
        onToggleHidden={fm.toggleHidden}
        onNewFolder={() => setDialog({ kind: "newfolder" })}
        onCrumb={fm.navigate}
      />

      <div className="flex-1 flex min-h-0">
        <Sidebar places={fm.places} cwd={fm.cwd} onSelect={fm.navigate} />

        {fm.mode === "edit" ? (
          <div className="flex-1 flex min-w-0">
            <FileList
              entries={fm.listing?.entries ?? []}
              selected={fm.selected}
              onSelect={fm.previewEntry}
              onOpen={fm.openEntry}
              onContext={onContext}
            />
            {fm.opened ? (
              <Editor entry={fm.opened} onClose={() => fm.setOpened(null)} onError={fm.setError} />
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)]">
                Sélectionne un fichier pour l'éditer
              </div>
            )}
          </div>
        ) : (
          <FileGrid
            entries={fm.listing?.entries ?? []}
            selected={fm.selected}
            onSelect={fm.setSelected}
            onOpen={fm.openEntry}
            onContext={onContext}
          />
        )}
      </div>

      {fm.error && (
        <div className="absolute bottom-3 right-3 max-w-md px-3 py-2 rounded-md bg-[var(--color-danger)] text-[var(--color-bg)] text-xs shadow-lg">
          {fm.error}
          <button className="ml-3 underline" onClick={() => fm.setError(null)}>OK</button>
        </div>
      )}

      {menu && (
        <ContextMenu
          menu={{ x: menu.x, y: menu.y, path: menu.entry.path, name: menu.entry.name }}
          onClose={() => setMenu(null)}
          onOpen={() => { fm.openEntry(menu.entry); setMenu(null); }}
          onRename={() => { setDialog({ kind: "rename", entry: menu.entry }); setMenu(null); }}
          onDelete={() => { setDialog({ kind: "delete", entry: menu.entry }); setMenu(null); }}
        />
      )}

      {dialog?.kind === "rename" && (
        <InputModal
          title="Renommer"
          initial={dialog.entry.name}
          onSubmit={(name) => { fm.rename(dialog.entry.path, name); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "newfolder" && (
        <InputModal
          title="Nouveau dossier"
          confirmLabel="Créer"
          onSubmit={(name) => { fm.newFolder(name); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmModal
          message={`Supprimer « ${dialog.entry.name} » ?`}
          onConfirm={() => { fm.remove(dialog.entry.path); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
