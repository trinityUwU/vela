// Assemblage du gestionnaire : topbar, sidebar, zone centrale (grille ou éditeur), modals.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFileManager } from "./hooks/useFileManager";
import { useProfiles } from "./hooks/useProfiles";
import { useBrowser } from "./hooks/useBrowser";
import { useFavorites } from "./hooks/useFavorites";
import { useSearch } from "./hooks/useSearch";
import { useSort, applySortFilter } from "./hooks/useSort";
import { useExtractions } from "./hooks/useExtractions";
import { useTransfers } from "./hooks/useTransfers";
import { useOcrJobs } from "./hooks/useOcrJobs";
import { useInstallPrompt } from "./hooks/useInstallPrompt";
import { useTerminals } from "./hooks/useTerminals";
import { useUndo } from "./hooks/useUndo";
import { useEditorTabs } from "./hooks/useEditorTabs";
import { useTags } from "./hooks/useTags";
import { useAppearance } from "./hooks/useAppearance";
import { hexFor } from "./services/tags";
import { getEntryProps } from "./services/fs";
import { OverlayHost } from "./components/OverlayHost";
import { useGridNav } from "./hooks/useGridNav";
import { useGitStatus } from "./hooks/useGitStatus";
import { useCommandPalette } from "./hooks/useCommandPalette";
import { useNlSettings } from "./hooks/useNlSettings";
import { nlResolve } from "./services/nl";
import { useCommandRegistry } from "./hooks/useCommandRegistry";
import { useKeyboard } from "./hooks/useKeyboard";
import { TerminalDock } from "./components/TerminalDock";
import { termInput, availableShells } from "./services/term";
import { Topbar } from "./components/Topbar";
import type { View } from "./components/Topbar";
import { SearchResults } from "./components/SearchBar";
import { SortBar } from "./components/SortBar";
import { ZoneLayout } from "./components/ZoneLayout";
import { ContextMenu } from "./components/ContextMenu";
import { BgContextMenu } from "./components/BgContextMenu";
import { DialogHost } from "./components/DialogHost";
import type { Dialog } from "./components/DialogHost";
import { InstallPrompt } from "./components/InstallPrompt";
import { QuickLook } from "./components/QuickLook";
import { ExtractionPanel } from "./components/ExtractionPanel";
import { BrowserView } from "./components/BrowserView";
import { startExtraction, trashDir, homeDir } from "./services/fs";
import { globalSearch } from "./services/search-index";
import { useFileActions } from "./hooks/useFileActions";
import { archiveStem, parentDir, baseName } from "./services/path-util";
import type { DirEntry } from "./types";

type Menu = { x: number; y: number; entry: DirEntry } | null;
type BgMenu = { x: number; y: number } | null;

export default function App() {
  const fm = useFileManager();
  const profiles = useProfiles();
  const browser = useBrowser();
  const activeProfile = profiles.active;
  const editorActive = Object.values(activeProfile.zones).includes("editor");
  const terminalInZone = Object.values(activeProfile.zones).includes("terminal");
  const { setEditorActive } = fm;
  useEffect(() => { setEditorActive(editorActive); }, [editorActive, setEditorActive]);
  const favs = useFavorites();
  const search = useSearch(fm.cwd);
  const { sort, toggleBy, update: updateSort } = useSort();
  const { jobs: extractionJobs } = useExtractions(fm.refresh);
  const { jobs: transferJobs } = useTransfers();
  const { jobs: ocrJobs } = useOcrJobs();
  const [menu, setMenu] = useState<Menu>(null);
  const [bgMenu, setBgMenu] = useState<BgMenu>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [quickLook, setQuickLook] = useState<DirEntry | null>(null);
  const [diff, setDiff] = useState<{ a: DirEntry; b: DirEntry } | null>(null);
  const [dirDiff, setDirDiff] = useState<{ a: string; b: string } | null>(null);
  const [trashPath, setTrashPath] = useState("");
  const [homePath, setHomePath] = useState("/");
  const terminals = useTerminals();
  const undo = useUndo(fm.setError, fm.refresh);
  useEffect(() => { fm.setRecorder(undo.push); }, [fm.setRecorder, undo.push]);
  const editorTabs = useEditorTabs(fm.opened, fm.setOpened);
  const tags = useTags();
  const git = useGitStatus(fm.cwd);
  const { appearance, setAccent, setDensity } = useAppearance();
  const tagHex = useCallback((path: string) => hexFor(tags.colorOf(path)), [tags]);
  const [folderSizes, setFolderSizes] = useState<Record<string, number>>({});
  const [analyzePath, setAnalyzePath] = useState<string | null>(null);
  const [translate, setTranslate] = useState<{ path: string | null } | null>(null);
  const [codeSearchOpen, setCodeSearchOpen] = useState(false);
  const [editPath, setEditPath] = useState<string | null>(null);

  const computeSize = useCallback((path: string) => {
    getEntryProps(path).then((p) => setFolderSizes((m) => ({ ...m, [path]: p.size }))).catch((e) => fm.setError(String(e)));
  }, [fm]);
  const [termVisible, setTermVisible] = useState(false);
  const install = useInstallPrompt(terminals.open, fm.cwd, () => setTermVisible(true));
  const [termHeight, setTermHeight] = useState(280);
  const [shells, setShells] = useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const palette = useCommandPalette();
  const nl = useNlSettings();
  const profileEditorProps = {
    profiles: profiles.profiles, activeId: profiles.activeId, onSwitch: profiles.setActive,
    upsert: profiles.upsertProfile, remove: profiles.removeProfile };
  const [view, setView] = useState<View>(() => ((localStorage.getItem("vela-view") as View) || "grid"));
  const setViewPersist = useCallback((v: View) => { setView(v); try { localStorage.setItem("vela-view", v); } catch {} }, []);

  useEffect(() => { trashDir().then(setTrashPath).catch(() => {}); homeDir().then(setHomePath).catch(() => {}); }, []);
  useEffect(() => { availableShells().then(setShells).catch(() => {}); }, []);
  useEffect(() => { if (browserOpen && browser.tabs.length === 0) browser.open(); }, [browserOpen]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (browserOpen && browser.tabs.length === 0) setBrowserOpen(false); }, [browser.tabs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleTerm = useCallback(() => {
    if (terminalInZone) { if (terminals.tabs.length === 0) terminals.open(fm.cwd); return; }
    setTermVisible((v) => {
      const next = !v;
      if (next && terminals.tabs.length === 0) terminals.open(fm.cwd);
      return next;
    });
  }, [terminalInZone, terminals, fm.cwd]);

  const newTerm = useCallback(() => { terminals.open(fm.cwd); }, [terminals, fm.cwd]);
  const openTerminalHere = useCallback((p: string) => { terminals.open(p); setTermVisible(true); }, [terminals]);
  const followTerm = useCallback(() => {
    if (!terminals.activeId) { terminals.open(fm.cwd); return; }
    const escaped = fm.cwd.replace(/'/g, "'\\''");
    termInput(terminals.activeId, `cd '${escaped}'\n`).catch(() => {});
  }, [terminals, fm.cwd]);
  const terminalProps = {
    tabs: terminals.tabs, activeId: terminals.activeId, onSelect: terminals.setActiveId, onNew: newTerm,
    onNewShell: (s: string) => terminals.open(fm.cwd, s), shells, onClose: terminals.close, onExit: terminals.exit,
    onFollow: followTerm, onHide: () => setTermVisible(false), onRename: terminals.rename, onSetColor: terminals.setColor,
  };

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

  const gridCols = useGridNav({
    entries, view, editorActive, selected: fm.selected,
    selectOne: fm.selectOne, openEntry: fm.openEntry, searchOpen: search.open,
  });

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
  const cwdEntry: DirEntry =
    { name: baseName(fm.cwd) || "/", path: fm.cwd, is_dir: true, size: 0, modified: 0, extension: "" };

  // ── actions menu (mono ou multi) ──────────────────────────────────────────
  const selPaths = (fallback?: string) => fm.selectionPaths(fallback);

  const askLabel = (p: string[]): string => p.length > 1 ? `${p.length} éléments` : `« ${baseName(p[0])} »`;
  const askTrash = (paths: string[]) => setDialog({ kind: "trash", paths, label: askLabel(paths) });
  const askDelete = (paths: string[]) => setDialog({ kind: "delete", paths, label: askLabel(paths) });

  const switchToEdition = useCallback(() => {
    const edition = profiles.profiles.find((p) => p.id === "edition");
    if (edition) profiles.setActive(edition.id);
    else fm.setEditorActive(true);
  }, [profiles, fm]);

  const openMatch = (path: string) => {
    const extension = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1) : "";
    const entry: DirEntry = { name: baseName(path), path, is_dir: false, size: 0, modified: 0, extension };
    switchToEdition();
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
    if (a.is_dir && b.is_dir) { setDirDiff({ a: a.path, b: b.path }); return; }
    if (a.is_dir !== b.is_dir) { fm.setError("Compare deux fichiers ou deux dossiers, pas un mélange"); return; }
    setDiff({ a, b });
  };

  const commands = useCommandRegistry({
    refresh: fm.refresh, toggleHidden: fm.toggleHidden, goUp: fm.goUp, goBack: fm.goBack, goForward: fm.goForward,
    navigate: fm.navigate, switchProfile: profiles.setActive, places: fm.places, profiles: profiles.profiles,
    activeProfileId: profiles.activeId, openTerminal: () => openTerminalHere(fm.cwd),
    openSettings: () => setSettingsOpen(true), openProfileEditor: () => setProfileEditorOpen(true),
    openDownload: () => setDownloadOpen(true), openBrowser: () => setBrowserOpen(true), openSearch: () => search.setOpen(true),
    openCodeSearch: () => setCodeSearchOpen(true), openTranslator: () => setTranslate({ path: null }),
    newFile: () => setDialog({ kind: "newfile" }), newFolder: () => setDialog({ kind: "newfolder" }),
    emptyTrash: () => setDialog({ kind: "emptytrash" }),
  });

  const { runSmartAction, runOcr, runConvert } = useFileActions({
    setError: fm.setError, refresh: fm.refresh, pushUndo: undo.push, onMissingTool: install.request,
  });
  const selectedEntries = entries.filter((e) => fm.selection.has(e.path));

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
    onPalette: palette.toggle,
  });

  return (
    <div className="h-full flex flex-col relative">
      <Topbar
        profiles={profiles.profiles}
        activeId={profiles.activeId}
        onSwitchProfile={profiles.setActive}
        onEditProfiles={() => setProfileEditorOpen(true)}
        showViewToggle={!editorActive}
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
        onCrumb={fm.navigate}
        onMove={fm.moveEntry}
        inTrash={!!trashPath && fm.cwd === trashPath}
        trashCount={fm.trashCount}
        onEmptyTrash={() => setDialog({ kind: "emptytrash" })}
        termOpen={termVisible}
        onToggleTerm={toggleTerm}
        browserOpen={browserOpen}
        onToggleBrowser={() => setBrowserOpen((v) => !v)}
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
          recents={search.recents}
          onApplyRecent={search.applyRecent}
          onClearRecents={search.clearRecents}
          onOpen={(e) => { fm.openEntry(e); search.close(); }}
          onNavigate={(p) => { fm.navigate(p); search.close(); }}
          onOpenMatch={openMatch}
        />
      )}

      {!activeProfile.filter_bar_hidden && (
        <SortBar
          sort={sort}
          onToggleBy={toggleBy}
          onFilter={(f) => updateSort({ filter: f })}
          onToggleDirsFirst={() => updateSort({ dirsFirst: !sort.dirsFirst })}
        />
      )}

      <ZoneLayout
        centerOverride={browserOpen ? <BrowserView browser={browser} /> : undefined}
        zones={activeProfile.zones}
        view={view}
        editorActive={editorActive}
        listing={{
          entries,
          selection: fm.selection,
          active: fm.selected,
          sort,
          onToggleBy: toggleBy,
          onSelect,
          onSelectEdit,
          onOpen: fm.openEntry,
          onContext,
          onContextBg,
          onClearBg: fm.clearSelection,
          onMove: fm.moveEntry,
          folderSizes,
          colorOf: tagHex,
          gitOf: (path: string) => git.statusMap.get(path),
          onColumns: (c) => { gridCols.current = c; },
        }}
        editor={{
          tabs: editorTabs.tabs,
          activePath: editorTabs.activePath,
          onSelect: editorTabs.select,
          onClose: editorTabs.close,
          onError: fm.setError,
          editPath,
        }}
        sidebar={{
          favs,
          places: fm.places,
          cwd: fm.cwd,
          trashDir: trashPath,
          trashCount: fm.trashCount,
          onSelect: fm.navigate,
          onPinCurrent: pinCurrent,
          onMove: fm.moveEntry,
          onOpenTrash: fm.openTrash,
          onEmptyTrash: () => setDialog({ kind: "emptytrash" }),
          onOpenSettings: () => setSettingsOpen(true),
          onOpenDownload: () => setDownloadOpen(true),
        }}
        filetree={{
          rootPath: homePath,
          cwd: fm.cwd,
          onNavigate: fm.navigate,
          showHidden: fm.showHidden,
          onError: fm.setError,
        }}
        terminal={terminalProps}
        git={{ state: git, cwd: fm.cwd, onError: fm.setError }}
      />

      {!terminalInZone && (termVisible || terminals.tabs.length > 0) && (
        <TerminalDock
          visible={termVisible}
          height={termHeight}
          terminal={terminalProps}
          onResize={(dy) => setTermHeight((h) => Math.max(120, Math.min(window.innerHeight - 160, h - dy)))}
        />
      )}

      {fm.error && (
        <div className="absolute bottom-3 right-3 max-w-md px-3 py-2 rounded-md bg-[var(--color-danger)] text-[var(--color-bg)] text-xs shadow-lg">
          {fm.error}<button className="ml-3 underline" onClick={() => fm.setError(null)}>OK</button>
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
          onComputeSize={() => { computeSize(menu.entry.path); setMenu(null); }}
          onAnalyze={() => { setAnalyzePath(menu.entry.path); setMenu(null); }}
          onMediaTools={() => {
            switchToEdition();
            fm.setOpened(menu.entry);
            setEditPath(menu.entry.path);
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
          onConvert={(target) => { runConvert(menu.entry.path, target); setMenu(null); }}
          onOcr={() => { runOcr(menu.entry.path); setMenu(null); }}
          onTranslate={() => { setTranslate({ path: menu.entry.path }); setMenu(null); }}
          entries={selectedEntries.length ? selectedEntries : [menu.entry]}
          onSmartAction={(id) => { runSmartAction(id, selectedEntries.length ? selectedEntries : [menu.entry]); setMenu(null); }}
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

      <DialogHost
        dialog={dialog}
        onClose={() => setDialog(null)}
        fm={fm}
        archiveStem={archiveStem}
        baseName={baseName}
      />

      {quickLook && (
        <QuickLook entry={quickLook} onClose={() => setQuickLook(null)} onError={fm.setError} />
      )}

      <ExtractionPanel jobs={extractionJobs} transfers={transferJobs} ocr={ocrJobs} onNavigate={fm.navigate} />
      <InstallPrompt prompt={install.prompt} onInstall={install.run} onDismiss={install.dismiss} />

      <OverlayHost
        settings={settingsOpen ? {
          onClose: () => setSettingsOpen(false),
          appearance: { accent: appearance.accent, density: appearance.density, onAccent: setAccent, onDensity: setDensity },
          onResetBrowser: browser.reset,
          nl: {
            enabled: nl.settings.enabled, endpoint: nl.settings.endpoint,
            onToggle: (v: boolean) => nl.update({ enabled: v }), onEndpoint: (v: string) => nl.update({ endpoint: v }),
          },
        } : null}
        profileEditor={profileEditorOpen ? { ...profileEditorProps, onClose: () => setProfileEditorOpen(false) } : null}
        download={downloadOpen ? { cwd: fm.cwd, onClose: () => setDownloadOpen(false), onError: fm.setError } : null}
        diff={diff ? { a: diff.a, b: diff.b, onClose: () => setDiff(null), onError: fm.setError } : null}
        dirDiff={dirDiff ? { a: dirDiff.a, b: dirDiff.b, onClose: () => setDirDiff(null), onError: fm.setError } : null}
        analyzer={analyzePath ? { path: analyzePath, onClose: () => setAnalyzePath(null), onReveal: fm.navigate, onError: fm.setError } : null}
        translate={translate ? { path: translate.path, onClose: () => { setTranslate(null); fm.refresh(); } } : null}
        codeSearch={codeSearchOpen ? { project: fm.cwd, onReveal: (p: string) => { openMatch(p); setCodeSearchOpen(false); }, onClose: () => setCodeSearchOpen(false) } : null}
        palette={palette.open ? {
          commands, entries, onOpenEntry: fm.openEntry,
          onGlobalSearch: (q) => globalSearch(q, 20),
          onResolveNl: nl.settings.enabled ? (q) => nlResolve(nl.settings.endpoint, q, commands) : undefined,
          onClose: palette.close,
        } : null}
      />
    </div>
  );
}
