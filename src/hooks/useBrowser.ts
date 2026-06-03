// Modèle d'onglets du navigateur intégré : état pur + normalisation URL + sync titre via event natif.
import { useCallback, useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { listen } from "@tauri-apps/api/event";
import { browserEval, browserNavigate, browserReset, hostnameOf, normalizeUrl } from "../services/browser";
import type { BrowserTab } from "../types";

const DEFAULT_URL = "https://www.google.com";

export interface UseBrowserResult {
  tabs: BrowserTab[];
  activeId: string | null;
  open: (url?: string) => void;
  close: (id: string) => void;
  setActive: (id: string) => void;
  navigate: (id: string, url: string) => void;
  back: () => void;
  forward: () => void;
  reload: () => void;
  reset: () => void;
}

type SetTabs = Dispatch<SetStateAction<BrowserTab[]>>;
type SetActive = Dispatch<SetStateAction<string | null>>;

function makeTab(url: string): BrowserTab {
  const u = normalizeUrl(url);
  return { id: `b${Date.now()}${Math.floor(Math.random() * 1000)}`, url: u, title: hostnameOf(u) };
}

function useNavEvents(setTabs: SetTabs): void {
  useEffect(() => {
    const un = listen<[string, string]>("browser-nav", (e) => {
      const [id, url] = e.payload;
      setTabs((t) => t.map((x) => (x.id === id ? { ...x, url, title: hostnameOf(url) } : x)));
    });
    return () => { un.then((u) => u()); };
  }, [setTabs]);
}

function useActions(setTabs: SetTabs, setActive: SetActive, activeId: string | null): Omit<UseBrowserResult, "tabs" | "activeId" | "setActive"> {
  const open = useCallback((url?: string) => {
    const tab = makeTab(url ?? DEFAULT_URL);
    setTabs((t) => [...t, tab]);
    setActive(tab.id);
  }, [setTabs, setActive]);
  const close = useCallback((id: string) => {
    setTabs((t) => {
      const next = t.filter((x) => x.id !== id);
      setActive((cur) => (cur === id ? next[next.length - 1]?.id ?? null : cur));
      return next;
    });
  }, [setTabs, setActive]);
  const navigate = useCallback((id: string, url: string) => {
    const u = normalizeUrl(url);
    setTabs((t) => t.map((x) => (x.id === id ? { ...x, url: u, title: hostnameOf(u) } : x)));
    browserNavigate(id, u).catch((e) => console.error("[browser] navigate", e));
  }, [setTabs]);
  const evalActive = useCallback((js: string) => {
    if (activeId) browserEval(activeId, js).catch((e) => console.error("[browser] eval", e));
  }, [activeId]);
  const reset = useCallback(() => {
    browserReset().catch((e) => console.error("[browser] reset", e));
    setTabs([]);
    setActive(null);
  }, [setTabs, setActive]);
  return {
    open, close, navigate, reset,
    back: useCallback(() => evalActive("history.back()"), [evalActive]),
    forward: useCallback(() => evalActive("history.forward()"), [evalActive]),
    reload: useCallback(() => evalActive("location.reload()"), [evalActive]),
  };
}

export function useBrowser(): UseBrowserResult {
  const [tabs, setTabs] = useState<BrowserTab[]>([]);
  const [activeId, setActive] = useState<string | null>(null);
  useNavEvents(setTabs);
  const actions = useActions(setTabs, setActive, activeId);
  return { tabs, activeId, setActive, ...actions };
}
