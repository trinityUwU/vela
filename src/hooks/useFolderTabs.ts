// Sous-système onglets de dossiers : navigation isolée par onglet. L'onglet actif EST l'état live
// (cwd/listing/selection/historique) ; les inactifs sont des snapshots restaurés au changement.
import { useCallback, useEffect, useState, type MutableRefObject } from "react";
import * as fs from "../services/fs";
import type { DirEntry, DirListing } from "../types";

export interface FolderTab {
  id: string;
  cwd: string;
  history: string[];
  histIdx: number;
  selection: string[];
  selected: string | null;
  name?: string;
  color?: string;
}

// Forme persistée d'un onglet (cwd + libellé/couleur custom). L'historique n'est pas conservé au redémarrage.
export interface TabSeed {
  cwd: string;
  name?: string;
  color?: string;
}

function newTabId(): string {
  return crypto.randomUUID();
}

// État live partagé avec useFileManager : l'onglet actif lit/écrit directement ces valeurs.
interface Live {
  cwd: string;
  selection: Set<string>;
  selected: string | null;
  showHidden: boolean;
  history: MutableRefObject<string[]>;
  histIdx: MutableRefObject<number>;
  anchor: MutableRefObject<string | null>;
  setListing: (l: DirListing) => void;
  setCwd: (p: string) => void;
  setSelection: (s: Set<string>) => void;
  setSelected: (p: string | null) => void;
  setHistState: (s: { canBack: boolean; canForward: boolean }) => void;
  setError: (e: string | null) => void;
}

export function useFolderTabs(live: Live) {
  const { cwd, selection, selected, showHidden, history, histIdx, anchor } = live;
  const { setListing, setCwd, setSelection, setSelected, setHistState, setError } = live;
  const [tabs, setTabs] = useState<FolderTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");

  // Restaure un onglet dans l'état live : liste son cwd, recharge sa sélection (filtrée aux entrées
  // existantes). Les refs d'historique doivent déjà pointer sur l'onglet cible.
  const restoreTab = useCallback(
    async (tab: FolderTab) => {
      try {
        const data = await fs.listDir(tab.cwd, showHidden);
        setListing(data);
        setCwd(data.path);
        const exist = new Set(data.entries.map((e: DirEntry) => e.path));
        setSelection(new Set(tab.selection.filter((p) => exist.has(p))));
        setSelected(tab.selected && exist.has(tab.selected) ? tab.selected : null);
        anchor.current = tab.selected ?? null;
        setHistState({ canBack: histIdx.current > 0, canForward: histIdx.current < history.current.length - 1 });
        setError(null);
      } catch (e) {
        setError(String(e));
      }
    },
    [showHidden, setListing, setCwd, setSelection, setSelected, anchor, setHistState, histIdx, history, setError],
  );

  // Capture l'état live courant dans l'onglet actif (avant bascule ou création).
  const snapshotActive = useCallback(
    (list: FolderTab[]): FolderTab[] =>
      list.map((t) =>
        t.id === activeTabId
          ? { ...t, cwd, history: [...history.current], histIdx: histIdx.current, selection: [...selection], selected }
          : t,
      ),
    [activeTabId, cwd, selection, selected, history, histIdx],
  );

  const switchTab = useCallback(
    (id: string) => {
      if (id === activeTabId) return;
      const target = tabs.find((t) => t.id === id);
      if (!target) return;
      setTabs((prev) => snapshotActive(prev));
      setActiveTabId(id);
      history.current = [...target.history];
      histIdx.current = target.histIdx;
      restoreTab(target);
    },
    [activeTabId, tabs, snapshotActive, restoreTab, history, histIdx],
  );

  const newTab = useCallback(
    (path?: string) => {
      const start = path ?? cwd;
      const id = newTabId();
      const fresh: FolderTab = { id, cwd: start, history: [start], histIdx: 0, selection: [], selected: null };
      setTabs((prev) => [...snapshotActive(prev), fresh]);
      setActiveTabId(id);
      history.current = [start];
      histIdx.current = 0;
      restoreTab(fresh);
    },
    [cwd, snapshotActive, restoreTab, history, histIdx],
  );

  const closeTab = useCallback(
    (id: string) => {
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx < 0) return;
      const next = tabs.filter((t) => t.id !== id);
      setTabs(next);
      if (id === activeTabId) {
        const neighbor = next[Math.min(idx, next.length - 1)];
        setActiveTabId(neighbor.id);
        history.current = [...neighbor.history];
        histIdx.current = neighbor.histIdx;
        restoreTab(neighbor);
      }
    },
    [tabs, activeTabId, restoreTab, history, histIdx],
  );

  const cycleTab = useCallback(
    (dir: 1 | -1) => {
      if (tabs.length <= 1) return;
      const i = tabs.findIndex((t) => t.id === activeTabId);
      const j = (i + dir + tabs.length) % tabs.length;
      switchTab(tabs[j].id);
    },
    [tabs, activeTabId, switchTab],
  );

  const renameTab = useCallback((id: string, name: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, name: name.trim() || undefined } : t)));
  }, []);

  const setTabColor = useCallback((id: string, color: string) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, color: color || undefined } : t)));
  }, []);

  // Initialise les onglets au démarrage et renvoie le cwd actif (que useFileManager ira lister).
  const initTabs = useCallback(
    (seeds: TabSeed[], activeIdx: number): string => {
      const built: FolderTab[] = seeds.map((s) => ({
        id: newTabId(), cwd: s.cwd, history: [s.cwd], histIdx: 0, selection: [], selected: null,
        name: s.name, color: s.color,
      }));
      const ai = Math.min(Math.max(activeIdx, 0), built.length - 1);
      const active = built[ai];
      setTabs(built);
      setActiveTabId(active.id);
      history.current = [active.cwd];
      histIdx.current = 0;
      return active.cwd;
    },
    [history, histIdx],
  );

  // Synchronise le libellé de l'onglet actif (son cwd) au fil de la navigation interne.
  useEffect(() => {
    if (!cwd || !activeTabId) return;
    setTabs((prev) => {
      const t = prev.find((x) => x.id === activeTabId);
      if (!t || t.cwd === cwd) return prev;
      return prev.map((x) => (x.id === activeTabId ? { ...x, cwd } : x));
    });
  }, [cwd, activeTabId]);

  return { tabs, activeTabId, newTab, closeTab, switchTab, cycleTab, renameTab, setTabColor, initTabs };
}
