// État central du gestionnaire : navigation, listing, sélection multiple, presse-papier, ops.
import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import * as fs from "../services/fs";
import { isEditable } from "../services/file-kind";
import type { UndoEntry } from "./useUndo";
import type { Clipboard, ClipboardOp, DirEntry, DirListing, Place } from "../types";

function baseName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

const SESSION_KEY = "vela-session";

interface Session {
  cwd?: string;
  showHidden?: boolean;
}

function loadSession(): Session {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveSession(s: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch {
    /* quota — ignore */
  }
}

export function useFileManager() {
  const session = useRef(loadSession()).current;
  const [editorActive, setEditorActive] = useState(false);
  const [cwd, setCwd] = useState<string>("");
  const [listing, setListing] = useState<DirListing | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  const [opened, setOpened] = useState<DirEntry | null>(null);
  const [showHidden, setShowHidden] = useState(session.showHidden ?? false);
  const [error, setError] = useState<string | null>(null);
  const [trashCount, setTrashCount] = useState(0);
  const anchor = useRef<string | null>(null);
  const recordRef = useRef<(e: UndoEntry) => void>(() => {});
  const setRecorder = useCallback((fn: (e: UndoEntry) => void) => { recordRef.current = fn; }, []);

  const history = useRef<string[]>([]);
  const histIdx = useRef(-1);
  const [histState, setHistState] = useState({ canBack: false, canForward: false });

  const refreshTrashCount = useCallback(() => {
    fs.trashCount().then(setTrashCount).catch(() => {});
  }, []);

  const navigateInternal = useCallback(
    async (path: string, fromHistory: boolean) => {
      try {
        const data = await fs.listDir(path, showHidden);
        setListing(data);
        setCwd(data.path);
        setSelected(null);
        setSelection(new Set());
        anchor.current = null;
        setError(null);
        if (!fromHistory && data.path !== history.current[histIdx.current]) {
          history.current = history.current.slice(0, histIdx.current + 1);
          history.current.push(data.path);
          histIdx.current = history.current.length - 1;
        }
        setHistState({ canBack: histIdx.current > 0, canForward: histIdx.current < history.current.length - 1 });
      } catch (e) {
        setError(String(e));
      }
    },
    [showHidden],
  );

  const navigate = useCallback((path: string) => navigateInternal(path, false), [navigateInternal]);

  const goBack = useCallback(() => {
    if (histIdx.current <= 0) return;
    histIdx.current -= 1;
    navigateInternal(history.current[histIdx.current], true);
  }, [navigateInternal]);

  const goForward = useCallback(() => {
    if (histIdx.current >= history.current.length - 1) return;
    histIdx.current += 1;
    navigateInternal(history.current[histIdx.current], true);
  }, [navigateInternal]);

  useEffect(() => {
    (async () => {
      try {
        const [home, pl] = await Promise.all([fs.homeDir(), fs.listPlaces()]);
        setPlaces(pl);
        await navigate(session.cwd || home);
      } catch (e) {
        setError(String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cwd) saveSession({ cwd, showHidden });
  }, [cwd, showHidden]);

  // ── watch live du dossier courant ───────────────────────────────────────────
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (cwd) fs.watchDir(cwd).catch(() => {});
  }, [cwd]);

  useEffect(() => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const unlistenP = listen<string>("fs-changed", () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => refreshRef.current(), 250);
    });
    return () => {
      if (debounce) clearTimeout(debounce);
      unlistenP.then((u) => u());
    };
  }, []);

  // ── sélection ──────────────────────────────────────────────────────────────

  const selectOne = useCallback((path: string) => {
    anchor.current = path;
    setSelected(path);
    setSelection(new Set([path]));
  }, []);

  const toggleSelect = useCallback((path: string) => {
    anchor.current = path;
    setSelected(path);
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const rangeSelect = useCallback(
    (path: string, ordered: DirEntry[]) => {
      const from = anchor.current ?? path;
      const i = ordered.findIndex((e) => e.path === from);
      const j = ordered.findIndex((e) => e.path === path);
      if (i < 0 || j < 0) return selectOne(path);
      const [lo, hi] = i < j ? [i, j] : [j, i];
      const range = ordered.slice(lo, hi + 1).map((e) => e.path);
      setSelected(path);
      setSelection(new Set(range));
    },
    [selectOne],
  );

  const selectAll = useCallback((ordered: DirEntry[]) => {
    setSelection(new Set(ordered.map((e) => e.path)));
  }, []);

  const clearSelection = useCallback(() => {
    setSelection(new Set());
    setSelected(null);
    anchor.current = null;
  }, []);

  const selectionPaths = useCallback(
    (fallback?: string): string[] => {
      if (selection.size > 0) return [...selection];
      if (fallback) return [fallback];
      if (selected) return [selected];
      return [];
    },
    [selection, selected],
  );

  const openEntry = useCallback(
    async (entry: DirEntry) => {
      if (entry.is_dir) return navigate(entry.path);
      if (editorActive && isEditable(entry.extension)) {
        setOpened(entry);
        return;
      }
      try {
        await fs.openNative(entry.path);
      } catch (e) {
        setError(String(e));
      }
    },
    [editorActive, navigate],
  );

  const previewEntry = useCallback(
    (entry: DirEntry) => {
      if (entry.is_dir) {
        navigate(entry.path);
        return;
      }
      selectOne(entry.path);
      if (isEditable(entry.extension)) setOpened(entry);
    },
    [navigate, selectOne],
  );

  const refresh = useCallback(() => navigate(cwd), [cwd, navigate]);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => { refreshTrashCount(); }, [refreshTrashCount]);

  useEffect(() => {
    if (cwd) navigate(cwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  const goUp = useCallback(() => {
    if (listing?.parent) navigate(listing.parent);
  }, [listing, navigate]);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const rename = useCallback(
    async (path: string, name: string) => {
      try {
        const newPath = await fs.renameEntry(path, name);
        recordRef.current({ kind: "rename", renames: [{ path: newPath, prevName: baseName(path) }] });
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  const remove = useCallback(
    async (path: string) => {
      try {
        await fs.deleteEntry(path);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  const newFolder = useCallback(
    async (name: string) => {
      try {
        await fs.createDir(cwd, name);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [cwd, refresh],
  );

  const createFile = useCallback(
    async (name: string) => {
      try {
        await fs.writeFile(`${cwd}/${name}`, "");
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [cwd, refresh],
  );

  const renameMany = useCallback(
    async (dir: string, renames: { from: string; to: string }[]) => {
      try {
        const undo: { path: string; prevName: string }[] = [];
        for (const r of renames) {
          const newPath = await fs.renameEntry(`${dir}/${r.from}`, r.to);
          undo.push({ path: newPath, prevName: r.from });
        }
        if (undo.length) recordRef.current({ kind: "rename", renames: undo });
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  const moveEntry = useCallback(
    async (src: string, destDir: string) => {
      try {
        const paths = selection.has(src) ? [...selection] : [src];
        await fs.moveEntries(paths, destDir);
        recordRef.current({ kind: "move", moves: paths.map((p) => ({ from: p, to: `${destDir}/${baseName(p)}` })) });
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh, selection],
  );

  // ── opérations groupées ────────────────────────────────────────────────────

  const trash = useCallback(
    async (paths: string[]) => {
      try {
        await fs.trashEntries(paths);
        recordRef.current({ kind: "trash", originals: paths });
        await refresh();
        refreshTrashCount();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh, refreshTrashCount],
  );

  const emptyTrash = useCallback(async () => {
    try {
      await fs.emptyTrash();
      refreshTrashCount();
      const dir = await fs.trashDir();
      if (cwd === dir) await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [cwd, refresh, refreshTrashCount]);

  const openTrash = useCallback(async () => {
    try {
      await navigate(await fs.trashDir());
    } catch (e) {
      setError(String(e));
    }
  }, [navigate]);

  const deletePermanent = useCallback(
    async (paths: string[]) => {
      try {
        await fs.deleteEntries(paths);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  const copyToClipboard = useCallback(
    (op: ClipboardOp, paths: string[]) => {
      if (paths.length > 0) setClipboard({ op, paths });
    },
    [],
  );

  const paste = useCallback(async () => {
    if (!clipboard) return;
    try {
      if (clipboard.op === "copy") {
        const created = await fs.copyEntries(clipboard.paths, cwd);
        if (created.length) recordRef.current({ kind: "copy", created });
      } else {
        await fs.moveEntries(clipboard.paths, cwd);
        recordRef.current({ kind: "move", moves: clipboard.paths.map((p) => ({ from: p, to: `${cwd}/${baseName(p)}` })) });
        setClipboard(null);
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [clipboard, cwd, refresh]);

  const compress = useCallback(
    async (paths: string[], dest: string, format: "zip" | "targz") => {
      try {
        await fs.createArchive(paths, dest, format);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  const toggleHidden = useCallback(() => setShowHidden((v) => !v), []);

  return {
    editorActive, setEditorActive,
    cwd, listing, places,
    selected, setSelected,
    selection, selectOne, toggleSelect, rangeSelect, selectAll, clearSelection, selectionPaths,
    clipboard, copyToClipboard, paste,
    opened, setOpened,
    showHidden, toggleHidden,
    error, setError,
    navigate, openEntry, previewEntry, goUp, refresh,
    goBack, goForward, canBack: histState.canBack, canForward: histState.canForward,
    rename, renameMany, remove, newFolder, createFile, moveEntry,
    trash, deletePermanent, compress,
    trashCount, emptyTrash, openTrash,
    setRecorder,
  };
}
