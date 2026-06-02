// Assemblage du gestionnaire : topbar, sidebar, zone centrale (grille ou éditeur), modals.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFileManager } from "./hooks/useFileManager";
import { useFavorites } from "./hooks/useFavorites";
import { useSearch } from "./hooks/useSearch";
import { useSort, applySortFilter } from "./hooks/useSort";
import { useExtractions } from "./hooks/useExtractions";
import { useTransfers } from "./hooks/useTransfers";
import { useTerminals } from "./hooks/useTerminals";
import { useUndo } from "./hooks/useUndo";
import { useEditorTabs } from "./hooks/useEditorTabs";
import { useTags } from "./hooks/useTags";
import { hexFor } from "./services/tags";
import { useKeyboard } from "./hooks/useKeyboard";
import { TerminalPanel } from "./components/TerminalPanel";
import { termInput, availableShells } from "./services/term";
import { Topbar } from "./components/Topbar";
import type { View } from "./components/Topbar";
import { SearchResults } from "./components/SearchBar";
import { SortBar } from "./components/SortBar";
import { Sidebar } from "./components/Sidebar";
import { FileGrid } from "./components/FileGrid";
import { FileTable } from "./components/FileTable";
import { FileList } from "./components/FileList";
import { EditorArea } from "./components/EditorArea";
import { ContextMenu } from "./components/ContextMenu";
import { BgContextMenu } from "./components/BgContextMenu";
import { InputModal } from "./components/InputModal";
import { ConfirmModal } from "./components/ConfirmModal";
import { PropertiesModal } from "./components/PropertiesModal";
import { CompressModal } from "./components/CompressModal";
import { BatchRenameModal } from "./components/BatchRenameModal";
import { QuickLook } from "./components/QuickLook";
import { ExtractionPanel } from "./components/ExtractionPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { DiffViewer } from "./components/DiffViewer";
import { startExtraction, trashDir } from "./services/fs";
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
  | { kind: "emptytrash" }
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
  const { jobs: transferJobs } = useTransfers();
  const [menu, setMenu] = useState<Menu>(null);
  const [bgMenu, setBgMenu] = useState<BgMenu>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [quickLook, setQuickLook] = useState<DirEntry | null>(null);
  const [diff, setDiff] = useState<{ a: DirEntry; b: DirEntry } | null>(null);
  const [trashPath, setTrashPath] = useState("");
  const terminals = useTerminals();
  const undo = useUndo(fm.setError, fm.refresh);
  useEffect(() => { fm.setRecorder(undo.push); }, [fm.setRecorder, undo.push]);
  const editorTabs = useEditorTabs(fm.opened, fm.setOpened);
  const tags = useTags();
  const tagHex = useCallback((path: string) => hexFor(tags.colorOf(path)), [tags]);
  const [termVisible, setTermVisible] = useState(false);
  const [termHeight, setTermHeight] = useState(280);
  const [shells, setShells] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<View>(() => ((localStorage.getItem("vela-view") as View) || "grid"));
  const setViewPersist = useCallback((v: View) => { setView(v); try { localStorage.setItem("vela-view", v); } catch {} }, []);

  useEffect(() => { trashDir().then(setTrashPath).catch(() => {}); }, []);
  useEffect(() => { availableShells().then(setShells).catch(() => {}); }, []);

  const toggleTerm = useCallback(() => {
    setTermVisible((v) => {
      const next = !v;
      if (next && terminals.tabs.length === 0) terminals.open(fm.cwd);
      return next;
    });
  }, [terminals, fm.cwd]);

  const newTerm = useCallback(() => { terminals.open(fm.cwd); }, [terminals, fm.cwd]);

  const openTerminalHere = useCallback((path: string) => {
    terminals.open(path);
    setTermVisible(true);
  }, [terminals]);

  const followTerm = useCallback(() => {
    if (!terminals.activeId) { terminals.open(fm.cwd); return; }
    const escaped = fm.cwd.replace(/'/g, "'\\''");
    termInput(terminals.activeId, `cd '${escaped}'\n`).catch(() => {});
  }, [terminals, fm.cwd]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "`") { e.preventDefault(); toggleTerm(); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [toggleTerm]);

  const entries = useMemo(
    () => applySortFilter(fm.listing?.entries ?? [], sort),
    [fm.listing, sort],
  );

  const gridCols = useRef(1);
  const moveSel = useCallback((delta: number) => {
    if (!entries.length) return;
    const i = entries.findIndex((e) => e.path === fm.selected);
    const next = i < 0 ? (delta > 0 ? 0 : entries.length - 1) : Math.max(0, Math.min(entries.length - 1, i + delta));
    fm.selectOne(entries[next].path);
  }, [entries, fm.selected, fm.selectOne]);

  const navSel = useCallback((delta: number, axis: "x" | "y") => {
    const grid = view === "grid" && fm.mode === "files";
    if (!grid) { if (axis === "x") return; moveSel(delta); return; }
    moveSel(axis === "y" ? delta * gridCols.current : delta);
  }, [view, fm.mode, moveSel]);

  const activateSel = useCallback(() => {
    const e = entries.find((x) => x.path === fm.selected);
    if (e) fm.openEntry(e);
  }, [entries, fm.selected, fm.openEntry]);

  // Navigation clavier : capture phase → preventDefault annule le scroll natif, indépendant du focus.
  // e.code (position physique) : robuste aux variantes WebKitGTK (e.key peut valoir "Up" vs "ArrowUp").
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (search.open || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable || t.closest(".cm-editor"))) return;
      const k = e.code || e.key;
      if (k === "Enter" || k === "NumpadEnter") { e.preventDefault(); activateSel(); return; }
      if (k === "ArrowUp" || k === "Up") { e.preventDefault(); navSel(-1, "y"); return; }
      if (k === "ArrowDown" || k === "Down") { e.preventDefault(); navSel(1, "y"); return; }
      if (k === "ArrowLeft" || k === "Left") { e.preventDefault(); navSel(-1, "x"); return; }
      if (k === "ArrowRight" || k === "Right") { e.preventDefault(); navSel(1, "x"); return; }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [search.open, navSel, activateSel]);

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

  const compareSelection = (fallback?: string) => {
    const paths = selPaths(fallback);
    if (paths.length !== 2) return;
    const a = entries.find((e) => e.path === paths[0]);
    const b = entries.find((e) => e.path === paths[1]);
    if (!a || !b) return;
    if (a.is_dir || b.is_dir) { fm.setError("Comparaison possible uniquement entre deux fichiers"); return; }
    setDiff({ a, b });
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
    onUndo: undo.undo,
    onBack: fm.goBack,
    onForward: fm.goForward,
  });

  return (
    <div className="h-full flex flex-col relative">
      <Topbar
        mode={fm.mode}
        onMode={fm.setMode}
        path={fm.cwd}
        showHidden={fm.showHidden}
        view={view}
        onView={setViewPersist}
        onBack={fm.goBack}
        onForward={fm.goForward}
        canBack={fm.canBack}
        canForward={fm.canForward}
        onUp={fm.goUp}
        onRefresh={fm.refresh}
        onToggleHidden={fm.toggleHidden}
        onNewFolder={() => setDialog({ kind: "newfolder" })}
        onCrumb={fm.navigate}
        onMove={fm.moveEntry}
        inTrash={!!trashPath && fm.cwd === trashPath}
        trashCount={fm.trashCount}
        onEmptyTrash={() => setDialog({ kind: "emptytrash" })}
        termOpen={termVisible}
        onToggleTerm={toggleTerm}
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
          trashDir={trashPath}
          trashCount={fm.trashCount}
          onSelect={fm.navigate}
          onPinCurrent={pinCurrent}
          onMove={fm.moveEntry}
          onOpenTrash={fm.openTrash}
          onEmptyTrash={() => setDialog({ kind: "emptytrash" })}
          onOpenSettings={() => setSettingsOpen(true)}
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
              colorOf={tagHex}
            />
            <EditorArea
              tabs={editorTabs.tabs}
              activePath={editorTabs.activePath}
              onSelect={editorTabs.select}
              onClose={editorTabs.close}
              onError={fm.setError}
            />
          </div>
        ) : view === "list" ? (
          <FileTable
            entries={entries}
            selection={fm.selection}
            active={fm.selected}
            sort={sort}
            onToggleBy={toggleBy}
            onSelect={onSelect}
            onOpen={fm.openEntry}
            onContext={onContext}
            onContextBg={onContextBg}
            onClearBg={fm.clearSelection}
            onMove={fm.moveEntry}
            colorOf={tagHex}
          />
        ) : (
          <FileGrid
            entries={entries}
            selection={fm.selection}
            active={fm.selected}
            onSelect={onSelect}
            onOpen={fm.openEntry}
            onContext={onContext}
            onContextBg={onContextBg}
            onClearBg={fm.clearSelection}
            onMove={fm.moveEntry}
            onColumns={(c) => { gridCols.current = c; }}
            colorOf={tagHex}
          />
        )}
      </div>

      {(termVisible || terminals.tabs.length > 0) && (
        <div
          className={`shrink-0 flex flex-col ${termVisible ? "" : "hidden"}`}
          style={{ height: termVisible ? termHeight : 0 }}
        >
          <ResizeHandle onResize={(dy) => setTermHeight((h) => Math.max(120, Math.min(window.innerHeight - 160, h - dy)))} />
          <div className="flex-1 min-h-0">
            <TerminalPanel
              tabs={terminals.tabs}
              activeId={terminals.activeId}
              onSelect={terminals.setActiveId}
              onNew={newTerm}
              onNewShell={(s) => terminals.open(fm.cwd, s)}
              shells={shells}
              onClose={terminals.close}
              onExit={terminals.exit}
              onFollow={followTerm}
              onHide={() => setTermVisible(false)}
              onRename={terminals.rename}
              onSetColor={terminals.setColor}
            />
          </div>
        </div>
      )}

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
          onCompare={() => { compareSelection(menu.entry.path); setMenu(null); }}
          onSetColor={(color) => tags.setColor(selPaths(menu.entry.path), color)}
          currentColor={tags.colorOf(menu.entry.path)}
          onOpenTerminal={() => { openTerminalHere(menu.entry.path); setMenu(null); }}
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
      {dialog?.kind === "emptytrash" && (
        <ConfirmModal
          message="Vider la corbeille ? Tous les éléments seront supprimés définitivement."
          onConfirm={() => { fm.emptyTrash(); setDialog(null); }}
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

      <ExtractionPanel jobs={extractionJobs} transfers={transferJobs} onNavigate={fm.navigate} />

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      {diff && <DiffViewer a={diff.a} b={diff.b} onClose={() => setDiff(null)} onError={fm.setError} />}
    </div>
  );
}

// Poignée de redimensionnement vertical du panneau terminal (drag).
function ResizeHandle({ onResize }: { onResize: (dy: number) => void }) {
  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    let last = e.clientY;
    const move = (ev: MouseEvent) => { onResize(ev.clientY - last); last = ev.clientY; };
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return (
    <div
      onMouseDown={onMouseDown}
      className="h-1 cursor-ns-resize bg-[var(--color-border)] hover:bg-[var(--color-accent)] shrink-0"
    />
  );
}
