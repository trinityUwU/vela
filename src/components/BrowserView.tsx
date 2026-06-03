// Navigateur intégré : chrome React (onglets + barre d'adresse) + sync de la couche webview native.
import { useEffect, useRef, useState } from "react";
import { browserClose, browserCreate, browserHide, browserShow } from "../services/browser";
import type { Bounds } from "../services/browser";
import type { BrowserTab } from "../types";
import type { UseBrowserResult } from "../hooks/useBrowser";
import { ChevronLeft, ChevronRight, Refresh } from "./icons";

interface TabStripProps {
  tabs: BrowserTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNew: () => void;
}

function TabStrip({ tabs, activeId, onSelect, onClose, onNew }: TabStripProps): React.ReactElement {
  return (
    <div className="flex items-center gap-1 px-2 h-9 border-b border-[var(--color-border)] bg-[var(--color-surface)] overflow-x-auto">
      {tabs.map((t) => (
        <div
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`group flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs cursor-pointer shrink-0 max-w-44 ${
            t.id === activeId
              ? "bg-[var(--color-bg)] text-[var(--color-text)]"
              : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          <span className="truncate">{t.title || "Nouvel onglet"}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(t.id); }}
            className="opacity-50 hover:opacity-100 leading-none"
          >
            ×
          </button>
        </div>
      ))}
      <button onClick={onNew} className="px-2 h-7 rounded-md text-sm text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] shrink-0">
        +
      </button>
    </div>
  );
}

interface NavBarProps {
  addr: string;
  setAddr: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
}

function NavBar({ addr, setAddr, onSubmit, onBack, onForward, onReload }: NavBarProps): React.ReactElement {
  const btn = "p-1 rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]";
  return (
    <div className="flex items-center gap-1.5 px-2 h-9 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
      <button onClick={onBack} title="Précédent" className={btn}><ChevronLeft width={16} height={16} /></button>
      <button onClick={onForward} title="Suivant" className={btn}><ChevronRight width={16} height={16} /></button>
      <button onClick={onReload} title="Recharger" className={btn}><Refresh width={15} height={15} /></button>
      <input
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
        placeholder="Rechercher ou saisir une adresse"
        className="flex-1 h-7 px-3 rounded-full bg-[var(--color-bg)] border border-[var(--color-border)] text-xs text-[var(--color-text)] outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  );
}

function useNativeSync(tabs: BrowserTab[], activeId: string | null, areaRef: React.RefObject<HTMLDivElement | null>): void {
  const created = useRef<Set<string>>(new Set());
  const measure = (): Bounds => {
    const r = areaRef.current?.getBoundingClientRect();
    return { x: r?.left ?? 0, y: r?.top ?? 0, w: r?.width ?? 1, h: r?.height ?? 1 };
  };
  useEffect(() => {
    if (!areaRef.current) return;
    const b = measure();
    tabs.forEach((t) => {
      if (!created.current.has(t.id)) {
        created.current.add(t.id);
        browserCreate(t.id, t.url, b).catch((e) => console.error("[browser] create", e));
      }
    });
    [...created.current].forEach((id) => {
      if (!tabs.find((t) => t.id === id)) { created.current.delete(id); browserClose(id).catch(() => {}); }
    });
    tabs.forEach((t) => (t.id === activeId ? browserShow(t.id, b) : browserHide(t.id)).catch(() => {}));
  }, [tabs, activeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    const sync = (): void => { if (activeId) browserShow(activeId, measure()).catch(() => {}); };
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    window.addEventListener("resize", sync);
    return () => { ro.disconnect(); window.removeEventListener("resize", sync); };
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { created.current.forEach((id) => browserClose(id).catch(() => {})); }, []);
}

export function BrowserView({ browser }: { browser: UseBrowserResult }): React.ReactElement {
  const { tabs, activeId, open, close, setActive, navigate, back, forward, reload } = browser;
  const areaRef = useRef<HTMLDivElement>(null);
  const active = tabs.find((t) => t.id === activeId);
  const [addr, setAddr] = useState("");
  useEffect(() => { setAddr(active?.url ?? ""); }, [active?.url, activeId]);
  useNativeSync(tabs, activeId, areaRef);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[var(--color-bg)]">
      <TabStrip tabs={tabs} activeId={activeId} onSelect={setActive} onClose={close} onNew={() => open()} />
      <NavBar
        addr={addr}
        setAddr={setAddr}
        onSubmit={() => { if (activeId) navigate(activeId, addr); }}
        onBack={back}
        onForward={forward}
        onReload={reload}
      />
      <div ref={areaRef} className="flex-1 min-h-0" />
    </div>
  );
}
