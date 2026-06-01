// Assemblage du gestionnaire : topbar, sidebar, zone centrale (grille ou éditeur), modals.
import { useState } from "react";
import { useFileManager } from "./hooks/useFileManager";
import { useFavorites } from "./hooks/useFavorites";
import { useSearch } from "./hooks/useSearch";
import { useSort, applySortFilter } from "./hooks/useSort";
import { useExtractions } from "./hooks/useExtractions";
import { Topbar } from "./components/Topbar";
import { SearchResults } from "./components/SearchBar";
import { SortBar } from "./components/SortBar";
import { Sidebar } from "./components/Sidebar";
import { FileGrid } from "./components/FileGrid";
import { FileList } from "./components/FileList";
import { Editor } from "./components/Editor";
import { ContextMenu } from "./components/ContextMenu";
import { BgContextMenu } from "./components/BgContextMenu";
import { InputModal } from "./components/InputModal";
import { ConfirmModal } from "./components/ConfirmModal";
import { PropertiesModal } from "./components/PropertiesModal";
import { ExtractionPanel } from "./components/ExtractionPanel";
import type { DirEntry } from "./types";

type Menu = { x: number; y: number; entry: DirEntry } | null;
type BgMenu = { x: number; y: number } | null;
type Dialog =
  | { kind: "rename"; entry: DirEntry }
  | { kind: "newfolder" }
  | { kind: "newfile" }
  | { kind: "delete"; entry: DirEntry }
  | { kind: "props"; entry: DirEntry }
  | null;

export default function App() {
  const fm = useFileManager();
  const favs = useFavorites();
  const search = useSearch(fm.cwd);
  const { sort, toggleBy, update: updateSort } = useSort();
  const { jobs: extractionJobs } = useExtractions();
  const [menu, setMenu] = useState<Menu>(null);
  const [bgMenu, setBgMenu] = useState<BgMenu>(null);
  const [dialog, setDialog] = useState<Dialog>(null);

  const entries = applySortFilter(fm.listing?.entries ?? [], sort);

  const onContext = (e: React.MouseEvent, entry: DirEntry) => {
    e.preventDefault();
    setBgMenu(null);
    fm.setSelected(entry.path);
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const onContextBg = (e: React.MouseEvent) => {
    setMenu(null);
    setBgMenu({ x: e.clientX, y: e.clientY });
  };

  const pinCurrent = () => {
    const name = fm.cwd.split("/").filter(Boolean).pop() ?? fm.cwd;
    favs.pinPath(fm.cwd, name);
  };

  const cwdEntry: DirEntry = {
    name: fm.cwd.split("/").filter(Boolean).pop() || "/",
    path: fm.cwd,
    is_dir: true,
    size: 0,
    modified: 0,
    extension: "",
  };

  return (
    <div className="h-full flex flex-col relative">
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
        onMove={fm.moveEntry}
        searchOpen={search.open}
        searchQuery={search.query}
        onSearchOpen={() => search.setOpen(true)}
        onSearchQuery={search.setQuery}
        onSearchClose={search.close}
      />
      {search.open && (
        <SearchResults
          results={search.results}
          searching={search.searching}
          query={search.query}
          onOpen={(e) => { fm.openEntry(e); search.close(); }}
          onNavigate={(p) => { fm.navigate(p); search.close(); }}
        />
      )}

      <SortBar
        sort={sort}
        onToggleBy={toggleBy}
        onFilter={(f) => updateSort({ filter: f })}
        onToggleDirsFirst={() => updateSort({ dirsFirst: !sort.dirsFirst })}
      />

      <div className="flex-1 flex min-h-0">
        <Sidebar
          favs={favs}
          places={fm.places}
          cwd={fm.cwd}
          onSelect={fm.navigate}
          onPinCurrent={pinCurrent}
          onMove={fm.moveEntry}
        />

        {fm.mode === "edit" ? (
          <div className="flex-1 flex min-w-0">
            <FileList
              entries={entries}
              selected={fm.selected}
              onSelect={fm.previewEntry}
              onOpen={fm.openEntry}
              onContext={onContext}
              onContextBg={onContextBg}
              onMove={fm.moveEntry}
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
            entries={entries}
            selected={fm.selected}
            onSelect={fm.setSelected}
            onOpen={fm.openEntry}
            onContext={onContext}
            onContextBg={onContextBg}
            onMove={fm.moveEntry}
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
          menu={{ x: menu.x, y: menu.y, path: menu.entry.path, name: menu.entry.name, isDir: menu.entry.is_dir, cwd: fm.cwd }}
          onClose={() => setMenu(null)}
          onOpen={() => { fm.openEntry(menu.entry); setMenu(null); }}
          onRename={() => { setDialog({ kind: "rename", entry: menu.entry }); setMenu(null); }}
          onDelete={() => { setDialog({ kind: "delete", entry: menu.entry }); setMenu(null); }}
          onProperties={() => { setDialog({ kind: "props", entry: menu.entry }); setMenu(null); }}
        />
      )}

      {bgMenu && (
        <BgContextMenu
          x={bgMenu.x}
          y={bgMenu.y}
          showHidden={fm.showHidden}
          onClose={() => setBgMenu(null)}
          onNewFile={() => { setDialog({ kind: "newfile" }); setBgMenu(null); }}
          onNewFolder={() => { setDialog({ kind: "newfolder" }); setBgMenu(null); }}
          onRefresh={() => { fm.refresh(); setBgMenu(null); }}
          onToggleHidden={() => { fm.toggleHidden(); setBgMenu(null); }}
          onPinCurrent={() => { pinCurrent(); setBgMenu(null); }}
          onProperties={() => { setDialog({ kind: "props", entry: cwdEntry }); setBgMenu(null); }}
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
      {dialog?.kind === "newfile" && (
        <InputModal
          title="Nouveau fichier"
          confirmLabel="Créer"
          placeholder="nom.txt"
          onSubmit={(name) => { fm.createFile(name); setDialog(null); }}
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
      {dialog?.kind === "props" && (
        <PropertiesModal entry={dialog.entry} onClose={() => setDialog(null)} />
      )}

      <ExtractionPanel jobs={extractionJobs} onNavigate={fm.navigate} />
    </div>
  );
}
