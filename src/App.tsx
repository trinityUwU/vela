// Assemblage du gestionnaire : topbar, sidebar, zone centrale (grille ou éditeur), modals.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
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
import { getEntryProps, writeFile, diskFree, startExtraction, pathExists } from "./services/fs";
import { scanConflicts, copyEntries, moveEntries } from "./services/fs";
import { usePane } from "./hooks/usePane";
import { useProject } from "./hooks/useProject";
import { useWorkspaces } from "./hooks/useWorkspaces";
import { templateInstantiate, saveAsTemplate } from "./services/templates";
import { previewKind } from "./services/file-kind";
import { useSmartSearches } from "./hooks/useSmartSearches";
import type { SearchCriteria } from "./services/advsearch";
import type { TabSeed } from "./hooks/useFolderTabs";
import { OverlayHost } from "./components/OverlayHost";
import { StatusBar } from "./components/StatusBar";
import { InputModal } from "./components/InputModal";
import { FeatureOverlays } from "./components/FeatureOverlays";
import type { Conflict, ConflictResolution } from "./services/fs";
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
import { TabStrip } from "./components/TabStrip";
import { SearchResults } from "./components/SearchBar";
import { SortBar } from "./components/SortBar";
import { ZoneLayout } from "./components/ZoneLayout";
import type { ListingProps } from "./components/ZoneLayout";
import { ContextMenus } from "./components/ContextMenus";
import { DialogHost } from "./components/DialogHost";
import type { Dialog } from "./components/DialogHost";
import { InstallPrompt } from "./components/InstallPrompt";
import { ExtractionPanel } from "./components/ExtractionPanel";
import { BrowserView } from "./components/BrowserView";
import { trashDir, homeDir } from "./services/fs";
import { globalSearch } from "./services/search-index";
import { useFileActions } from "./hooks/useFileActions";
import { archiveStem, baseName, parentDir } from "./services/path-util";
import { gitDiff } from "./services/git";
import type { DirEntry } from "./types";

type Menu = { x: number; y: number; entry: DirEntry } | null;
type BgMenu = { x: number; y: number } | null;

function defaultCriteria(root: string): SearchCriteria {
  return { root, recursive: true, hidden: false, name: "", content: "", extensions: [], sizeMin: null, sizeMax: null, after: null, before: null };
}

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
  const [diff, setDiff] = useState<{ a: DirEntry; b: DirEntry; docs?: { a: string; b: string } } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [disk, setDisk] = useState<[number, number] | null>(null);
  const [showStatusBar, setShowStatusBar] = useState(() => localStorage.getItem("vela-statusbar") !== "0");
  const toggleStatusBar = useCallback(() => setShowStatusBar((v) => {
    const next = !v;
    localStorage.setItem("vela-statusbar", next ? "1" : "0");
    return next;
  }), []);
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
  const [hashPath, setHashPath] = useState<string | null>(null);
  const [hexPath, setHexPath] = useState<string | null>(null);
  const [templatePick, setTemplatePick] = useState(false);
  const [sharePaths, setSharePaths] = useState<string[] | null>(null);
  const [pdfPaths, setPdfPaths] = useState<string[] | null>(null);
  const [annotatePath, setAnnotatePath] = useState<string | null>(null);
  const [findReplaceRoot, setFindReplaceRoot] = useState<string | null>(null);
  const [advSearch, setAdvSearch] = useState<{ criteria: SearchCriteria; autoRun: boolean } | null>(null);
  const [smartName, setSmartName] = useState<SearchCriteria | null>(null);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [batchImages, setBatchImages] = useState<string[] | null>(null);
  const [videoToolsPath, setVideoToolsPath] = useState<string | null>(null);
  const workspaces = useWorkspaces();
  const smartSearches = useSmartSearches();
  const [extractConflict, setExtractConflict] = useState<{ archivePath: string; dest: string } | null>(null);
  const [conflictReq, setConflictReq] = useState<
    { conflicts: Conflict[]; resolve: (r: Record<string, ConflictResolution> | null) => void } | null
  >(null);
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
  // Overlay git dans l'explorateur (activé par défaut), persisté.
  const [gitOverlay, setGitOverlay] = useState(() => localStorage.getItem("vela-git-overlay") !== "0");
  const toggleGitOverlay = useCallback(() => setGitOverlay((v) => {
    const next = !v; try { localStorage.setItem("vela-git-overlay", next ? "1" : "0"); } catch {} return next;
  }), []);
  // Dossiers ancêtres d'un fichier modifié → badge agrégé "dir" sur le dossier.
  const gitDirs = useMemo(() => {
    const s = new Set<string>();
    for (const p of git.statusMap.keys()) {
      let d = p.slice(0, p.lastIndexOf("/"));
      while (d.length > 1) { s.add(d); d = d.slice(0, d.lastIndexOf("/")); }
    }
    return s;
  }, [git.statusMap]);
  const gitOf = useCallback((path: string): string | undefined => {
    if (!gitOverlay) return undefined;
    return git.statusMap.get(path) ?? (gitDirs.has(path) ? "dir" : undefined);
  }, [gitOverlay, git.statusMap, gitDirs]);

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

  const project = useProject(fm.cwd);
  const runTask = useCallback(async (command: string) => {
    const id = await terminals.open(fm.cwd);
    setTermVisible(true);
    if (id) termInput(id, `${command}\n`).catch(() => {});
  }, [terminals, fm.cwd]);
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
    onOpenPath: (p: string, d: boolean) => openTermPath(p, d),
    onOpenUrl: (url: string) => { browser.open(url); setBrowserOpen(true); },
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
  const imageEntries = useMemo(
    () => entries.filter((e) => !e.is_dir && previewKind(e.extension) === "image"),
    [entries],
  );
  const openGallery = useCallback((path: string) => {
    const idx = imageEntries.findIndex((e) => e.path === path);
    setGalleryIndex(idx >= 0 ? idx : 0);
  }, [imageEntries]);

  useEffect(() => {
    if (!fm.cwd) { setDisk(null); return; }
    diskFree(fm.cwd).then(setDisk).catch(() => setDisk(null));
  }, [fm.cwd]);

  // Résolveur de conflits : la copie/déplacement attend la réponse de la modale (ou son annulation).
  useEffect(() => {
    fm.setConflictResolver((conflicts) => new Promise((resolve) => setConflictReq({ conflicts, resolve })));
  }, [fm.setConflictResolver]);

  // Extraction : si le dossier de destination existe déjà, demander avant d'écraser (zéro perte silencieuse).
  const extractArchive = useCallback((archivePath: string, dest: string) => {
    pathExists(dest)
      .then((exists) => {
        if (exists) setExtractConflict({ archivePath, dest });
        else startExtraction(archivePath, dest).catch((e) => fm.setError(String(e)));
      })
      .catch((e) => fm.setError(String(e)));
  }, [fm]);

  const selectedSize = useMemo(
    () => entries.reduce((sum, e) => {
      if (!fm.selection.has(e.path)) return sum;
      return sum + (e.is_dir ? (folderSizes[e.path] ?? 0) : e.size);
    }, 0),
    [entries, fm.selection, folderSizes],
  );

  const gridCols = useGridNav({
    entries, view, editorActive, selected: fm.selected,
    selectOne: fm.selectOne, openEntry: (e: DirEntry) => openInEditor(e), searchOpen: search.open,
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

  const openInEditor = (entry: DirEntry) => {
    if (entry.is_dir) return fm.navigate(entry.path);
    // Si le profil courant a déjà une zone éditeur, on y affiche le fichier sans le quitter ;
    // sinon seulement on bascule vers le profil Édition.
    if (activeHasEditorZone()) { showFileInEditor(entry.path); return; }
    switchToEdition(); fm.setOpened(entry); fm.setSelected(entry.path);
  };

  const fileEntry = (path: string): DirEntry => {
    const extension = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1) : "";
    return { name: baseName(path), path, is_dir: false, size: 0, modified: 0, extension };
  };
  // Affiche un fichier dans la zone éditeur du profil ACTUEL, sans changer de profil.
  const showFileInEditor = (path: string) => { const e = fileEntry(path); fm.setOpened(e); fm.setSelected(e.path); };
  const activeHasEditorZone = (): boolean => {
    const z = activeProfile.zones;
    return z.center === "editor" || z.left === "editor" || z.right === "editor" || z.bottom === "editor";
  };
  // Révèle un fichier : éditeur si le profil en a un, sinon navigue dans son dossier et le sélectionne
  // (après chargement du listing, sinon la nav réinitialise la sélection).
  const revealOrOpen = (path: string): void => {
    if (activeHasEditorZone()) { showFileInEditor(path); return; }
    fm.navigate(parentDir(path)).then(() => fm.selectOne(path));
  };

  // Clic sur un chemin dans le terminal : dossier → on entre ; fichier → affiché dans la zone éditeur
  // du profil courant si elle existe, sinon bascule sur le profil Édition (fallback du clic).
  const openTermPath = (path: string, isDir: boolean) => {
    if (isDir) return fm.navigate(path);
    if (activeHasEditorZone()) showFileInEditor(path);
    else openInEditor(fileEntry(path));
  };

  // Diff git d'un fichier (HEAD ↔ disque) en overlay — partagé par le GitPanel et le tool MCP show_diff.
  const openGitDiff = useCallback((path: string) => {
    gitDiff(git.repoRoot ?? fm.cwd, path)
      .then((d) => {
        const name = baseName(path);
        setDiff({
          a: { ...fileEntry(path), name: `${name} (HEAD)` },
          b: { ...fileEntry(path), name: `${name} (actuel)` },
          docs: { a: d.old, b: d.new },
        });
      })
      .catch((e) => fm.setError(String(e)));
  }, [git.repoRoot, fm]);

  // Control plane : commandes émises par le MCP de Vela (Claude Code lancé dans le terminal intégré).
  // open_file/preview_content : le Rust a déjà garanti qu'une zone éditeur existe → pas de switch ici.
  const controlRef = useRef<(action: string, args: Record<string, unknown>) => void>(() => {});
  controlRef.current = (action, args) => {
    if (action === "open_file") showFileInEditor(String(args.path ?? ""));
    else if (action === "open_url") { browser.open(String(args.url ?? "")); setBrowserOpen(true); }
    else if (action === "hide_browser") setBrowserOpen(false);
    else if (action === "navigate") fm.navigate(String(args.path ?? ""));
    else if (action === "reveal_file") {
      revealOrOpen(String(args.path ?? ""));
    }
    else if (action === "compare_files") {
      setDiff({ a: fileEntry(String(args.a ?? "")), b: fileEntry(String(args.b ?? "")) });
    }
    else if (action === "show_diff") openGitDiff(String(args.path ?? ""));
    else if (action === "notify") setNotice(String(args.message ?? ""));
    else if (action === "preview_content") {
      const safe = String(args.title ?? "apercu").replace(/[^\w.-]+/g, "_").slice(0, 60);
      const path = `/tmp/vela-preview-${safe}.txt`;
      writeFile(path, String(args.content ?? "")).then(() => showFileInEditor(path)).catch(() => {});
    }
  };
  useEffect(() => {
    const un = listen<{ action: string; args: Record<string, unknown> }>(
      "vela-control",
      (e) => controlRef.current(e.payload.action, e.payload.args),
    );
    return () => { un.then((f) => f()); };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const openMediaTools = (entry: DirEntry) => {
    switchToEdition(); fm.setOpened(entry); setEditPath(entry.path);
  };

  const openMatch = (path: string) => {
    const extension = path.includes(".") ? path.slice(path.lastIndexOf(".") + 1) : "";
    openInEditor({ name: baseName(path), path, is_dir: false, size: 0, modified: 0, extension });
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

  // ── volet jumeau (F03) ───────────────────────────────────────────────────────
  const twoListings = useMemo(() => {
    const z = activeProfile.zones;
    return [z.left, z.center, z.right, z.bottom].filter((p) => p === "listing").length >= 2;
  }, [activeProfile.zones]);
  const paneB = usePane("/", fm.showHidden);
  const [activePane, setActivePane] = useState<"a" | "b">("a");
  const paneInited = useRef(false);
  useEffect(() => {
    if (twoListings && !paneInited.current && fm.cwd) { paneB.navigate(fm.cwd); paneInited.current = true; }
    if (!twoListings) { paneInited.current = false; setActivePane("a"); }
  }, [twoListings, fm.cwd, paneB]);
  const entriesB = useMemo(() => applySortFilter(paneB.listing?.entries ?? [], sort), [paneB.listing, sort]);

  // Résolution de conflits réutilisant la modale globale (0 % perte sur les transferts inter-volets).
  const resolveConflictsModal = useCallback(
    async (paths: string[], destDir: string): Promise<Record<string, ConflictResolution> | null> => {
      const conflicts = await scanConflicts(paths, destDir);
      if (conflicts.length === 0) return {};
      return new Promise((resolve) => setConflictReq({ conflicts, resolve }));
    },
    [],
  );
  const paneTransfer = useCallback(async (op: "copy" | "move") => {
    const fromA = activePane === "a";
    const src = fromA ? selPaths() : paneB.selectionPaths();
    if (!src.length) return;
    const destDir = fromA ? paneB.cwd : fm.cwd;
    try {
      const res = await resolveConflictsModal(src, destDir);
      if (res === null) return;
      if (op === "copy") await copyEntries(src, destDir, res);
      else await moveEntries(src, destDir, res);
      fm.refresh(); paneB.refresh();
    } catch (e) { fm.setError(String(e)); }
  }, [activePane, paneB, fm, resolveConflictsModal]); // eslint-disable-line react-hooks/exhaustive-deps
  const paneSync = useCallback(() => {
    setDirDiff(activePane === "a" ? { a: fm.cwd, b: paneB.cwd } : { a: paneB.cwd, b: fm.cwd });
  }, [activePane, paneB.cwd, fm.cwd]);
  const switchPane = useCallback(() => setActivePane((p) => (p === "a" ? "b" : "a")), []);
  // En mode jumeau, la navigation (favoris, arbre) cible le volet actif, pas systématiquement le volet A.
  const navigateActive = useCallback((path: string) => {
    if (twoListings && activePane === "b") paneB.navigate(path);
    else fm.navigate(path);
  }, [twoListings, activePane, paneB, fm]);
  // Top bar : chemin + contrôles de navigation suivent le volet actif en mode jumeau.
  const isPaneB = twoListings && activePane === "b";
  const activeCwd = isPaneB ? paneB.cwd : fm.cwd;
  const activeNav = {
    back: isPaneB ? paneB.goBack : fm.goBack,
    forward: isPaneB ? paneB.goForward : fm.goForward,
    up: isPaneB ? paneB.goUp : fm.goUp,
    refresh: isPaneB ? paneB.refresh : fm.refresh,
    canBack: isPaneB ? paneB.canBack : fm.canBack,
    canForward: isPaneB ? paneB.canForward : fm.canForward,
  };
  const paneBListing: ListingProps = {
    entries: entriesB,
    selection: paneB.selection,
    active: paneB.selected,
    sort,
    onToggleBy: toggleBy,
    onSelect: (entry, e) => {
      if (e.shiftKey) paneB.rangeSelect(entry.path, entriesB);
      else if (e.ctrlKey || e.metaKey) paneB.toggleSelect(entry.path);
      else paneB.selectOne(entry.path);
    },
    onSelectEdit: (entry) => paneB.selectOne(entry.path),
    onOpen: (entry) => paneB.openEntry(entry),
    onContext: (e) => e.preventDefault(),
    onContextBg: (e) => { e.preventDefault(); paneB.clearSelection(); },
    onClearBg: paneB.clearSelection,
    onMove: () => {}, // glisser-déposer intra-volet B désactivé en v1 (sécurité données)
    folderSizes,
    colorOf: tagHex,
    gitOf: undefined,
    onColumns: () => {},
  };

  const commands = useCommandRegistry({
    refresh: fm.refresh, toggleHidden: fm.toggleHidden, goUp: fm.goUp, goBack: fm.goBack, goForward: fm.goForward,
    navigate: fm.navigate, switchProfile: profiles.setActive, places: fm.places, profiles: profiles.profiles,
    activeProfileId: profiles.activeId, openTerminal: () => openTerminalHere(fm.cwd),
    openSettings: () => setSettingsOpen(true), openProfileEditor: () => setProfileEditorOpen(true),
    openDownload: () => setDownloadOpen(true), openBrowser: () => setBrowserOpen(true), openSearch: () => search.setOpen(true),
    openCodeSearch: () => setCodeSearchOpen(true), openTranslator: () => setTranslate({ path: null }),
    newFile: () => setDialog({ kind: "newfile" }), newFolder: () => setDialog({ kind: "newfolder" }),
    newTab: () => fm.newTab(), closeTab: () => fm.closeTab(fm.activeTabId),
    emptyTrash: () => setDialog({ kind: "emptytrash" }),
    selectByPattern: () => setDialog({ kind: "selectpattern" }),
    invertSelection: () => fm.invertSelection(entries),
    hashSelected: () => {
      const p = selPaths();
      if (p.length === 1) setHashPath(p[0]);
      else fm.setError("Sélectionne un seul fichier pour calculer son empreinte.");
    },
    hexSelected: () => {
      const p = selPaths();
      if (p.length === 1) setHexPath(p[0]);
      else fm.setError("Sélectionne un seul fichier pour l'ouvrir en hexadécimal.");
    },
    shareSelected: () => { const p = selPaths(); if (p.length) setSharePaths(p); else fm.setError("Sélectionne quelque chose à partager."); },
    pdfTools: () => {
      const p = selPaths().filter((x) => x.toLowerCase().endsWith(".pdf"));
      if (p.length) setPdfPaths(p);
      else fm.setError("Sélectionne un ou plusieurs PDF.");
    },
    annotateSelected: () => {
      const p = selPaths();
      if (p.length === 1) setAnnotatePath(p[0]);
      else fm.setError("Sélectionne une seule image à annoter.");
    },
    findReplace: () => setFindReplaceRoot(fm.cwd),
    openGallery: () => {
      if (!imageEntries.length) { fm.setError("Aucune image dans ce dossier."); return; }
      const sel = selPaths()[0];
      openGallery(sel ?? imageEntries[0].path);
    },
    batchImages: () => {
      const imgs = selPaths().filter((p) => imageEntries.some((e) => e.path === p));
      const target = imgs.length ? imgs : imageEntries.map((e) => e.path);
      if (target.length) setBatchImages(target);
      else fm.setError("Sélectionne des images à traiter.");
    },
    newFromTemplate: () => setTemplatePick(true),
    saveAsTemplate: () => {
      const p = selPaths();
      if (p.length === 1) setDialog({ kind: "savetemplate", path: p[0] });
      else fm.setError("Sélectionne un seul élément à enregistrer comme modèle.");
    },
    saveWorkspace: () => setDialog({ kind: "saveworkspace" }),
    workspaces: workspaces.workspaces.map((w) => ({ id: w.id, name: w.name })),
    openWorkspace: (id) => {
      const ws = workspaces.workspaces.find((w) => w.id === id);
      if (!ws) return;
      profiles.setActive(ws.profileId);
      fm.openTabs(ws.tabs);
    },
    tasks: project.tasks,
    runTask,
    advancedSearch: () => setAdvSearch({ criteria: defaultCriteria(fm.cwd), autoRun: false }),
    smartSearches: smartSearches.searches.map((s) => ({ id: s.id, name: s.name })),
    openSmartSearch: (id) => {
      const s = smartSearches.searches.find((x) => x.id === id);
      if (s) setAdvSearch({ criteria: s.criteria, autoRun: true });
    },
  });

  const tabSeeds = useCallback((): TabSeed[] => fm.tabs.map((t) => ({ cwd: t.cwd, name: t.name, color: t.color })), [fm.tabs]);
  const instantiateTemplate = useCallback((name: string) => {
    templateInstantiate(name, fm.cwd, "").then(() => fm.refresh()).catch((e) => fm.setError(String(e)));
  }, [fm]);

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
    onNewTab: () => fm.newTab(),
    onCloseTab: () => fm.closeTab(fm.activeTabId),
    onNextTab: () => fm.cycleTab(1),
    onPrevTab: () => fm.cycleTab(-1),
    onPaneCopy: twoListings ? () => paneTransfer("copy") : undefined,
    onPaneMove: twoListings ? () => paneTransfer("move") : undefined,
    onSwitchPane: twoListings ? switchPane : undefined,
  });

  return (
    <div className="h-full flex flex-col relative">
      <Topbar
        profiles={profiles.profiles}
        activeId={profiles.activeId}
        onSwitchProfile={profiles.setActive}
        onEditProfiles={() => setProfileEditorOpen(true)}
        showViewToggle={!editorActive}
        path={activeCwd}
        showHidden={fm.showHidden}
        view={view}
        onView={setViewPersist}
        onBack={activeNav.back}
        onForward={activeNav.forward}
        canBack={activeNav.canBack}
        canForward={activeNav.canForward}
        onUp={activeNav.up}
        onRefresh={activeNav.refresh}
        onToggleHidden={fm.toggleHidden}
        onCrumb={navigateActive}
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
      <TabStrip
        tabs={fm.tabs}
        activeId={fm.activeTabId}
        onSelect={fm.switchTab}
        onClose={fm.closeTab}
        onNew={() => fm.newTab()}
        onRename={fm.renameTab}
        onSetColor={fm.setTabColor}
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
          onOpen={(e) => { openInEditor(e); search.close(); }}
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
          gitOverlay={gitOverlay}
          onToggleGit={toggleGitOverlay}
          inRepo={!!git.repoRoot}
          project={project}
          onRunTask={runTask}
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
          onOpen: openInEditor,
          onContext,
          onContextBg,
          onClearBg: fm.clearSelection,
          onMove: fm.moveEntry,
          folderSizes,
          colorOf: tagHex,
          gitOf,
          onColumns: (c) => { gridCols.current = c; },
        }}
        editor={{
          tabs: editorTabs.tabs,
          activePath: editorTabs.activePath,
          onSelect: editorTabs.select,
          onClose: editorTabs.close,
          onError: fm.setError,
          onContext,
          colorOf: tagHex,
          editPath,
        }}
        sidebar={{
          favs,
          places: fm.places,
          cwd: activeCwd,
          trashDir: trashPath,
          trashCount: fm.trashCount,
          onSelect: navigateActive,
          onPinCurrent: pinCurrent,
          onMove: fm.moveEntry,
          onOpenTrash: fm.openTrash,
          onEmptyTrash: () => setDialog({ kind: "emptytrash" }),
          onOpenSettings: () => setSettingsOpen(true),
          onOpenDownload: () => setDownloadOpen(true),
        }}
        filetree={{
          rootPath: homePath,
          cwd: activeCwd,
          onNavigate: navigateActive,
          showHidden: fm.showHidden,
          onError: fm.setError,
        }}
        terminal={terminalProps}
        git={{ state: git, cwd: fm.cwd, onError: fm.setError, onOpenFile: (p: string) => openTermPath(p, false), onDiff: openGitDiff }}
        listingB={twoListings ? paneBListing : undefined}
        activePane={activePane}
        onActivatePane={setActivePane}
        twin={twoListings ? {
          selectionCount: activePane === "a" ? fm.selection.size : paneB.selection.size,
          onCopy: () => paneTransfer("copy"),
          onMove: () => paneTransfer("move"),
          onSync: paneSync,
        } : undefined}
      />

      {showStatusBar && (
        <StatusBar
          total={entries.length}
          selectedCount={fm.selection.size}
          selectedSize={selectedSize}
          free={disk?.[0] ?? null}
          totalDisk={disk?.[1] ?? null}
        />
      )}

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

      {notice && (
        <div className="absolute bottom-3 right-3 max-w-md px-3 py-2 rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text)] text-xs shadow-lg">
          {notice}<button className="ml-3 text-[var(--color-text-dim)] hover:text-[var(--color-text)]" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      <ContextMenus
        menu={menu}
        bgMenu={bgMenu}
        cwd={fm.cwd}
        selectionSize={fm.selection.size || 1}
        showHidden={fm.showHidden}
        canPaste={!!fm.clipboard}
        selectedEntries={selectedEntries}
        cwdEntry={cwdEntry}
        colorOf={tags.colorOf}
        onCloseMenu={() => setMenu(null)}
        onCloseBg={() => setBgMenu(null)}
        selPaths={selPaths}
        openInEditor={openInEditor}
        openNewTab={(p) => fm.newTab(p)}
        openNative={fm.openNative}
        copyToClipboard={fm.copyToClipboard}
        onDialog={setDialog}
        askTrash={askTrash}
        askDelete={askDelete}
        compareSelection={compareSelection}
        setColor={tags.setColor}
        openTerminalHere={openTerminalHere}
        computeSize={computeSize}
        onAnalyze={setAnalyzePath}
        onHash={setHashPath}
        onHexView={setHexPath}
        onExtract={extractArchive}
        onMediaTools={openMediaTools}
        onTranslate={(p) => setTranslate({ path: p })}
        runConvert={runConvert}
        runOcr={runOcr}
        runSmartAction={runSmartAction}
        onError={(m) => fm.setError(m)}
        paste={fm.paste}
        refresh={fm.refresh}
        toggleHidden={fm.toggleHidden}
        pinCurrent={pinCurrent}
        onSaveTemplate={(p) => setDialog({ kind: "savetemplate", path: p })}
        onNewFromTemplate={() => setTemplatePick(true)}
        onShare={(p) => { if (p.length) setSharePaths(p); }}
        onPdfTools={(p) => { if (p.length) setPdfPaths(p); }}
        onAnnotate={setAnnotatePath}
        onFindReplace={setFindReplaceRoot}
        onGallery={openGallery}
        onBatchImages={(p) => { if (p.length) setBatchImages(p); }}
        onVideoTools={setVideoToolsPath}
      />

      <DialogHost
        dialog={dialog}
        onClose={() => setDialog(null)}
        fm={{ ...fm, extract: extractArchive }}
        archiveStem={archiveStem}
        baseName={baseName}
      />

      {dialog?.kind === "selectpattern" && (
        <InputModal
          title="Sélectionner par motif"
          confirmLabel="Sélectionner"
          placeholder="*.png  ou  /^IMG/i"
          onSubmit={(p) => { fm.selectByPattern(p, entries); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.kind === "savetemplate" && (
        <InputModal
          title="Enregistrer comme modèle"
          confirmLabel="Enregistrer"
          initial={baseName(dialog.path)}
          onSubmit={(name) => {
            saveAsTemplate(dialog.path, name).catch((e) => fm.setError(String(e)));
            setDialog(null);
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.kind === "saveworkspace" && (
        <InputModal
          title="Enregistrer l'espace de travail"
          confirmLabel="Enregistrer"
          placeholder="Nom de l'espace"
          onSubmit={(name) => { workspaces.save(name, profiles.activeId, tabSeeds()); setDialog(null); }}
          onCancel={() => setDialog(null)}
        />
      )}

      <FeatureOverlays
        templatePick={templatePick}
        onTemplatePick={instantiateTemplate}
        closeTemplatePick={() => setTemplatePick(false)}
        sharePaths={sharePaths}
        closeShare={() => setSharePaths(null)}
        pdfPaths={pdfPaths}
        closePdf={(r) => { setPdfPaths(null); if (r) { fm.refresh(); fm.navigate(parentDir(r)); } }}
        annotatePath={annotatePath}
        closeAnnotate={(s) => { setAnnotatePath(null); if (s) { fm.refresh(); fm.navigate(parentDir(s)); } }}
        videoToolsPath={videoToolsPath}
        closeVideoTools={(o) => { setVideoToolsPath(null); if (o) { setNotice("Vidéo traitée."); fm.navigate(parentDir(o)); } }}
        batchImages={batchImages}
        closeBatch={(d) => { setBatchImages(null); if (d) { setNotice("Images traitées."); fm.navigate(d); } }}
        galleryImages={imageEntries}
        galleryIndex={galleryIndex}
        closeGallery={() => setGalleryIndex(null)}
        advSearch={advSearch}
        onReveal={(p) => { revealOrOpen(p); setAdvSearch(null); }}
        onSaveSmart={(c) => setSmartName(c)}
        closeAdvSearch={() => setAdvSearch(null)}
        smartName={smartName}
        onSaveSmartName={(name, c) => { smartSearches.save(name, c); setSmartName(null); }}
        closeSmartName={() => setSmartName(null)}
        findReplaceRoot={findReplaceRoot}
        onApplied={(originals, summary) => {
          if (originals.length) undo.push({ kind: "bulk-edit", originals });
          setNotice(summary); setFindReplaceRoot(null); fm.refresh();
        }}
        closeFindReplace={() => setFindReplaceRoot(null)}
        quickLook={quickLook}
        closeQuickLook={() => setQuickLook(null)}
        hashPath={hashPath}
        closeHash={() => setHashPath(null)}
        hexPath={hexPath}
        closeHex={() => setHexPath(null)}
        conflictReq={conflictReq}
        resolveConflict={(r) => { conflictReq?.resolve(r); setConflictReq(null); }}
        extractConflict={extractConflict}
        onExtractReplace={() => { if (extractConflict) startExtraction(extractConflict.archivePath, extractConflict.dest, "replace").catch((e) => fm.setError(String(e))); setExtractConflict(null); }}
        onExtractKeepBoth={() => { if (extractConflict) startExtraction(extractConflict.archivePath, extractConflict.dest, "keep").catch((e) => fm.setError(String(e))); setExtractConflict(null); }}
        closeExtractConflict={() => setExtractConflict(null)}
        onError={fm.setError}
      />

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
          display: { statusBar: showStatusBar, onToggleStatusBar: toggleStatusBar },
        } : null}
        profileEditor={profileEditorOpen ? { ...profileEditorProps, onClose: () => setProfileEditorOpen(false) } : null}
        download={downloadOpen ? { cwd: activeCwd, onClose: () => setDownloadOpen(false), onError: fm.setError, onOpenUrl: (url: string) => { browser.open(url); setBrowserOpen(true); } } : null}
        diff={diff ? { a: diff.a, b: diff.b, docs: diff.docs, onClose: () => setDiff(null), onError: fm.setError } : null}
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
