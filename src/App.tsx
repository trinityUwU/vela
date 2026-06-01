// Assemblage du gestionnaire : topbar, sidebar, zone centrale (grille ou éditeur), modals.
import { useMemo, useState } from "react";
import { useFileManager } from "./hooks/useFileManager";
import { useFavorites } from "./hooks/useFavorites";
import { useSearch } from "./hooks/useSearch";
import { useSort, applySortFilter } from "./hooks/useSort";
import { useExtractions } from "./hooks/useExtractions";
import { useKeyboard } from "./hooks/useKeyboard";
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
import { CompressModal } from "./components/CompressModal";
import { BatchRenameModal } from "./components/BatchRenameModal";
import { QuickLook } from "./components/QuickLook";
import { ExtractionPanel } from "./components/ExtractionPanel";
import { startExtraction } from "./services/fs";
import type { DirEntry } from "./types";

type Menu = { x: number; y: number; entry: DirEntry } | null;
type BgMenu = { x: number; y: number } | null;
type Dialog =
  | { kind: "rename"; entry: DirEntry }
  | { kind: "newfolder" }
  | { kind: "newfile" }
  | { kind: "trash"; paths: string[]; label: string }
  | { kind: "delete"; paths: string[]; label: string }
  | { kind: "props"; entry: DirEntry }
  | { kind: "compress"; paths: string[] }
  | { kind: "batchrename"; names: string[] }
  | { kind: "extractto"; archivePath: string; defaultDest: string }
  | null;

function archiveStem(name: string): string {
  const compounds = [".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst", ".tar"];
  for (const c of compounds) {
    if (name.toLowerCase().endsWith(c)) return name.slice(0, -c.length);
  }
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function parentDir(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash > 0 ? path.slice(0, slash) : "/";
}

function baseName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

export default function App() {
  const fm = useFileManager();
  const favs = useFavorites();
  const search = useSearch(fm.cwd);
  const { sort, toggleBy, update: updateSort } = useSort();
  const { jobs: extractionJobs } = useExtractions();
  const [menu, setMenu] = useState<Menu>(null);
  const [bgMenu, setBgMenu] = useState<BgMenu>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [quickLook, setQuickLook] = useState<DirEntry | null>(null);

  const entries = useMemo(
    () => applySortFilter(fm.listing?.entries ?? [], sort),
    [fm.listing, sort],
  );

  const onSelect = (entry: DirEntry, e: React.MouseEvent) => {
    if (e.shiftKey) fm.rangeSelect(entry.path, entries);
    else if (e.ctrlKey || e.metaKey) fm.toggleSelect(entry.path);
    else fm.selectOne(entry.path);
  };

  const onSelectEdit = (entry: DirEntry, e: React.MouseEvent) => {
    if (e.shiftKey) { fm.rangeSelect(entry.path, entries); return; }
    if (e.ctrlKey || e.metaKey) { fm.toggleSelect(entry.path); return; }
    fm.previewEntry(entry);
  };

  const onContext = (e: React.MouseEvent, entry: DirEntry) => {
    e.preventDefault();
    setBgMenu(null);
    if (!fm.selection.has(entry.path)) fm.selectOne(entry.path);
    setMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const onContextBg = (e: React.MouseEvent) => {
    setMenu(null);
    setBgMenu({ x: e.clientX, y: e.clientY });
  };

  const pinCurrent = () => favs.pinPath(fm.cwd, baseName(fm.cwd));

  const cwdEntry: DirEntry = {
    name: baseName(fm.cwd) || "/",
    path: fm.cwd,
    is_dir: true,
    size: 0,
    modified: 0,
    extension: "",
  };

  // ── actions menu (mono ou multi) ──────────────────────────────────────────
  const selPaths = (fallback?: string) => fm.selectionPaths(fallback);

  const askTrash = (paths: string[]) => {
    const label = paths.length > 1 ? `${paths.length} éléments` : `« ${baseName(paths[0])} »`;
    setDialog({ kind: "trash", paths, label });
  };
  const askDelete = (paths: string[]) => {
    const label = paths.length > 1 ? `${paths.length} éléments` : `« ${baseName(paths[0])} »`;
    setDialog({ kind: "delete", paths, label });
  };

  const openMatch = (path: string) => {
    const entry: DirEntry = {
      name: baseName(path),
      path,
      is_dir: false,
      size: 0,
      modified: 0,
      extension: path.includes(".") ? path.slice(path.lastIndexOf(".") + 1) : "",
    };
    fm.setMode("edit");
    fm.setOpened(entry);
    fm.setSelected(path);
    search.close();
  };

  useKeyboard({
    onCopy: () => fm.copyToClipboard("copy", selPaths()),
    onCut: () => fm.copyToClipboard("cut", selPaths()),
    onPaste: () => fm.paste(),
    onSelectAll: () => fm.selectAll(entries),
    onTrash: () => { const p = selPaths(); if (p.length) askTrash(p); },
    onDeletePermanent: () => { const p = selPaths(); if (p.length) askDelete(p); },
    onRename: () => {
      const p = selPaths();
      if (p.length === 1) {
        const entry = entries.find((e) => e.path === p[0]);
        if (entry) setDialog({ kind: "rename", entry });
      }
    },
    onEscape: () => { setMenu(null); setBgMenu(null); if (quickLook) setQuickLook(null); else if (search.open) search.close(); else fm.clearSelection(); },
    onRefresh: fm.refresh,
    onFind: () => search.setOpen(true),
    onQuickLook: () => {
      const p = selPaths();
      if (p.length !== 1) return;
      const entry = entries.find((e) => e.path === p[0]);
      if (entry && !entry.is_dir) setQuickLook(entry);
    },
  });

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
        searchMode={search.mode}
        onSearchMode={search.setMode}
        onSearchOpen={() => search.setOpen(true)}
        onSearchQuery={search.setQuery}
        onSearchClose={search.close}
      />
      {search.open && (
        <SearchResults
          mode={search.mode}
          results={search.results}
          contentResults={search.contentResults}
          searching={search.searching}
          query={search.query}
          onOpen={(e) => { fm.openEntry(e); search.close(); }}
          onNavigate={(p) => { fm.navigate(p); search.close(); }}
          onOpenMatch={openMatch}
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
              selection={fm.selection}
              active={fm.selected}
              onSelect={onSelectEdit}
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
            selection={fm.selection}
            onSelect={onSelect}
            onOpen={fm.openEntry}
            onContext={onContext}
            onContextBg={onContextBg}
            onClearBg={fm.clearSelection}
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
          menu={{
            x: menu.x, y: menu.y, path: menu.entry.path, name: menu.entry.name,
            isDir: menu.entry.is_dir, extension: menu.entry.extension, cwd: fm.cwd,
            count: fm.selection.size || 1,
          }}
          onClose={() => setMenu(null)}
          onOpen={() => { fm.openEntry(menu.entry); setMenu(null); }}
          onRename={() => { setDialog({ kind: "rename", entry: menu.entry }); setMenu(null); }}
          onTrash={() => { askTrash(selPaths(menu.entry.path)); setMenu(null); }}
          onDeletePermanent={() => { askDelete(selPaths(menu.entry.path)); setMenu(null); }}
          onProperties={() => { setDialog({ kind: "props", entry: menu.entry }); setMenu(null); }}
          onCopy={() => { fm.copyToClipboard("copy", selPaths(menu.entry.path)); setMenu(null); }}
          onCut={() => { fm.copyToClipboard("cut", selPaths(menu.entry.path)); setMenu(null); }}
          onCompress={() => { setDialog({ kind: "compress", paths: selPaths(menu.entry.path) }); setMenu(null); }}
          onBatchRename={() => {
            const paths = selPaths(menu.entry.path);
            setDialog({ kind: "batchrename", names: paths.map(baseName) });
            setMenu(null);
          }}
          onExtractHere={() => {
            const dest = `${parentDir(menu.entry.path)}/${archiveStem(menu.entry.name)}`;
            startExtraction(menu.entry.path, dest).catch((e) => fm.setError(String(e)));
            setMenu(null);
          }}
          onExtractTo={() => {
            const defaultDest = `${parentDir(menu.entry.path)}/${archiveStem(menu.entry.name)}`;
            setDialog({ kind: "extractto", archivePath: menu.entry.path, defaultDest });
            setMenu(null);
          }}
        />
      )}

      {bgMenu && (
        <BgContextMenu
          x={bgMenu.x}
          y={bgMenu.y}
          showHidden={fm.showHidden}
          canPaste={!!fm.clipboard}
          onClose={() => setBgMenu(null)}
          onNewFile={() => { setDialog({ kind: "newfile" }); setBgMenu(null); }}
          onNewFolder={() => { setDialog({ kind: "newfolder" }); setBgMenu(null); }}
          onPaste={() => { fm.paste(); setBgMenu(null); }}
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
      {dialog?.kind === "trash" && (
        <ConfirmModal
          message={`Mettre ${dialog.label} à la corbeille ?`}
          onConfirm={() => { fm.trash(dialog.paths); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmModal
          message={`Supprimer définitivement ${dialog.label} ? Cette action est irréversible.`}
          onConfirm={() => { fm.deletePermanent(dialog.paths); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "props" && (
        <PropertiesModal entry={dialog.entry} onClose={() => setDialog(null)} />
      )}
      {dialog?.kind === "compress" && (
        <CompressModal
          count={dialog.paths.length}
          defaultName={dialog.paths.length === 1 ? archiveStem(baseName(dialog.paths[0])) : "archive"}
          onSubmit={(name, format) => {
            fm.compress(dialog.paths, `${fm.cwd}/${name}`, format);
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "batchrename" && (
        <BatchRenameModal
          names={dialog.names}
          onSubmit={(renames) => { fm.renameMany(fm.cwd, renames); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "extractto" && (
        <InputModal
          title="Extraire vers…"
          confirmLabel="Extraire"
          initial={dialog.defaultDest}
          onSubmit={(dest) => {
            if (dest.trim()) startExtraction(dialog.archivePath, dest.trim()).catch((e) => fm.setError(String(e)));
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {quickLook && (
        <QuickLook entry={quickLook} onClose={() => setQuickLook(null)} onError={fm.setError} />
      )}

      <ExtractionPanel jobs={extractionJobs} onNavigate={fm.navigate} />
    </div>
  );
}
