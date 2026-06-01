// État central du gestionnaire : navigation, listing, mode, sélection, ouverture, ops CRUD.
import { useCallback, useEffect, useState } from "react";
import * as fs from "../services/fs";
import { isEditable } from "../services/file-kind";
import type { DirEntry, DirListing, Mode, Place } from "../types";

export function useFileManager() {
  const [mode, setMode] = useState<Mode>("files");
  const [cwd, setCwd] = useState<string>("");
  const [listing, setListing] = useState<DirListing | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [opened, setOpened] = useState<DirEntry | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useCallback(
    async (path: string) => {
      try {
        const data = await fs.listDir(path, showHidden);
        setListing(data);
        setCwd(data.path);
        setSelected(null);
        setOpened(null);
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    },
    [showHidden],
  );

  useEffect(() => {
    (async () => {
      try {
        const [home, pl] = await Promise.all([fs.homeDir(), fs.listPlaces()]);
        setPlaces(pl);
        await navigate(home);
      } catch (e) {
        setError(String(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEntry = useCallback(
    async (entry: DirEntry) => {
      if (entry.is_dir) return navigate(entry.path);
      if (mode === "edit" && isEditable(entry.extension)) {
        setOpened(entry);
        return;
      }
      try {
        await fs.openNative(entry.path);
      } catch (e) {
        setError(String(e));
      }
    },
    [mode, navigate],
  );

  const previewEntry = useCallback(
    (entry: DirEntry) => {
      if (entry.is_dir) {
        navigate(entry.path);
        return;
      }
      setSelected(entry.path);
      if (isEditable(entry.extension)) setOpened(entry);
    },
    [navigate],
  );

  const refresh = useCallback(() => navigate(cwd), [cwd, navigate]);

  useEffect(() => {
    if (cwd) navigate(cwd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  const goUp = useCallback(() => {
    if (listing?.parent) navigate(listing.parent);
  }, [listing, navigate]);

  const rename = useCallback(
    async (path: string, name: string) => {
      try {
        await fs.renameEntry(path, name);
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

  const moveEntry = useCallback(
    async (src: string, destDir: string) => {
      try {
        await fs.moveEntry(src, destDir);
        await refresh();
      } catch (e) {
        setError(String(e));
      }
    },
    [refresh],
  );

  const toggleHidden = useCallback(() => setShowHidden((v) => !v), []);

  return {
    mode, setMode,
    cwd, listing, places,
    selected, setSelected,
    opened, setOpened,
    showHidden, toggleHidden,
    error, setError,
    navigate, openEntry, previewEntry, goUp, refresh,
    rename, remove, newFolder, createFile, moveEntry,
  };
}
