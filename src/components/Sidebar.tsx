// Sidebar : Favoris (pins libres + groupes) · Emplacements XDG · Montages.
import { useEffect, useRef, useState, useCallback } from "react";
import type { FavPin, Place } from "../types";
import type { useFavorites } from "../hooks/useFavorites";
import { Home, Folder, Drive, Trash, Settings } from "./icons";

type Favs = ReturnType<typeof useFavorites>;

interface Props {
  favs: Favs;
  places: Place[];
  cwd: string;
  trashDir: string;
  trashCount: number;
  onSelect: (path: string) => void;
  onPinCurrent: () => void;
  onMove: (src: string, destDir: string) => void;
  onOpenTrash: () => void;
  onEmptyTrash: () => void;
  onOpenSettings: () => void;
}

export function Sidebar({ favs, places, cwd, trashDir, trashCount, onSelect, onPinCurrent, onMove, onOpenTrash, onEmptyTrash, onOpenSettings }: Props) {
  const xdg = places.filter((p) => p.kind !== "mount");
  const mounts = places.filter((p) => p.kind === "mount");

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto flex flex-col">
      <FavSection favs={favs} cwd={cwd} onSelect={onSelect} onPinCurrent={onPinCurrent} onMove={onMove} />
      {xdg.length > 0 && (
        <>
          <SectionLabel>Emplacements</SectionLabel>
          {xdg.map((p) => (
            <PlaceRow key={p.path} label={p.name} path={p.path} active={cwd === p.path}
              icon={p.kind === "home" ? <Home /> : <Folder />} onSelect={onSelect} onMove={onMove} />
          ))}
        </>
      )}
      {mounts.length > 0 && (
        <>
          <SectionLabel>Montages</SectionLabel>
          {mounts.map((p) => (
            <PlaceRow key={p.path} label={p.name} path={p.path} active={cwd === p.path}
              icon={<Drive />} onSelect={onSelect} onMove={onMove} />
          ))}
        </>
      )}
      <div className="flex-1" />
      <SectionLabel>Système</SectionLabel>
      <TrashRow active={cwd === trashDir} count={trashCount} onOpen={onOpenTrash} onEmpty={onEmptyTrash} />
      <button
        onClick={onOpenSettings}
        className="w-full flex items-center gap-2.5 px-3 py-1.5 mb-1 text-sm text-left text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] transition-colors"
      >
        <span className="shrink-0 opacity-80"><Settings /></span>
        <span className="truncate">Réglages</span>
      </button>
    </aside>
  );
}

function TrashRow({ active, count, onOpen, onEmpty }: {
  active: boolean; count: number; onOpen: () => void; onEmpty: () => void;
}) {
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menu]);

  return (
    <>
      <button
        onClick={onOpen}
        onContextMenu={(e) => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
        className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors
          ${active ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]" : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"}`}
      >
        <span className="shrink-0 opacity-80"><Trash /></span>
        <span className="truncate flex-1">Corbeille</span>
        {count > 0 && (
          <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-bg)] text-[var(--color-text-dim)]">{count}</span>
        )}
      </button>
      {menu && (
        <div
          style={{ top: Math.max(4, menu.y - 52), left: menu.x }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 min-w-48 p-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
        >
          <button
            onClick={() => { onEmpty(); setMenu(null); }}
            disabled={count === 0}
            className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm rounded text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash width={15} height={15} />
            Vider la corbeille{count > 0 ? ` (${count})` : ""}
          </button>
        </div>
      )}
    </>
  );
}

function FavSection({ favs, cwd, onSelect, onPinCurrent, onMove }: {
  favs: Favs; cwd: string; onSelect: (p: string) => void; onPinCurrent: () => void; onMove: (src: string, destDir: string) => void;
}) {
  const [addingGroup, setAddingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const submitGroup = () => {
    const n = groupName.trim();
    if (n) favs.addGroup(n);
    setGroupName("");
    setAddingGroup(false);
  };

  return (
    <div className="py-1">
      <div className="flex items-center px-3 py-1 gap-1">
        <SectionLabel inline>Favoris</SectionLabel>
        <div className="flex-1" />
        <IconAction title="Épingler le dossier actuel" onClick={onPinCurrent}>＋</IconAction>
        <IconAction title="Créer un groupe" onClick={() => { setAddingGroup(true); setTimeout(() => inputRef.current?.focus(), 50); }}>⊞</IconAction>
      </div>

      {favs.favs.pins.map((pin) => (
        <PinRow key={pin.path} pin={pin} active={cwd === pin.path} onSelect={onSelect}
          onRemove={() => favs.unpin(pin.path)} onMove={onMove} />
      ))}

      {favs.favs.groups.map((g, gi) => (
        <div key={gi}>
          <GroupHeader
            name={g.name}
            collapsed={g.collapsed}
            onToggle={() => favs.toggleGroup(gi)}
            onRemove={() => favs.removeGroup(gi)}
            onPin={() => favs.pinPath(cwd, cwd.split("/").filter(Boolean).pop() ?? cwd, gi)}
          />
          {!g.collapsed && g.pins.map((pin) => (
            <PinRow key={pin.path} pin={pin} active={cwd === pin.path} onSelect={onSelect}
              onRemove={() => favs.unpin(pin.path, gi)} onMove={onMove} indent />
          ))}
        </div>
      ))}

      {addingGroup && (
        <div className="px-3 py-1">
          <input
            ref={inputRef}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitGroup();
              if (e.key === "Escape") { setAddingGroup(false); setGroupName(""); }
            }}
            onBlur={submitGroup}
            placeholder="Nom du groupe…"
            className="w-full px-2 py-1 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-accent)] text-[var(--color-text)] outline-none"
          />
        </div>
      )}
    </div>
  );
}

function GroupHeader({ name, collapsed, onToggle, onRemove, onPin }: {
  name: string; collapsed: boolean;
  onToggle: () => void; onRemove: () => void; onPin: () => void;
}) {
  return (
    <div className="group flex items-center gap-1 px-3 py-1 text-xs text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
      <button onClick={onToggle} className="shrink-0 w-3 text-center">{collapsed ? "▶" : "▼"}</button>
      <button onClick={onToggle} className="flex-1 text-left truncate">{name}</button>
      <span className="hidden group-hover:flex gap-1">
        <IconAction title="Épingler le dossier actuel dans ce groupe" onClick={onPin}>＋</IconAction>
        <IconAction title="Supprimer le groupe" onClick={onRemove} danger>✕</IconAction>
      </span>
    </div>
  );
}

function useDrop(destPath: string, onMove: (src: string, dest: string) => void) {
  const [dragOver, setDragOver] = useState(false);
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const src = e.dataTransfer.getData("application/vela");
    if (src && src !== destPath) onMove(src, destPath);
  }, [destPath, onMove]);
  return { dragOver, onDragOver, onDragLeave, onDrop };
}

function PinRow({ pin, active, onSelect, onRemove, onMove, indent }: {
  pin: FavPin; active: boolean; onSelect: (p: string) => void; onRemove: () => void;
  onMove: (src: string, dest: string) => void; indent?: boolean;
}) {
  const drop = useDrop(pin.path, onMove);
  return (
    <div
      {...drop}
      className={`group flex items-center gap-2 px-3 py-1.5 text-sm transition-colors cursor-pointer
        ${indent ? "pl-7" : ""}
        ${drop.dragOver ? "bg-[var(--color-accent-dim)]/20 ring-1 ring-[var(--color-accent)] ring-inset" : active ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]" : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"}`}
    >
      <span className="shrink-0 opacity-70"><Folder /></span>
      <button className="flex-1 text-left truncate text-inherit" onClick={() => onSelect(pin.path)} title={pin.path}>
        {pin.name}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="hidden group-hover:block text-[var(--color-text-dim)] hover:text-[var(--color-danger)] text-xs px-0.5"
        title="Retirer des favoris"
      >✕</button>
    </div>
  );
}

function PlaceRow({ label, path, active, icon, onSelect, onMove }: {
  label: string; path: string; active: boolean; icon: React.ReactNode;
  onSelect: (p: string) => void; onMove: (src: string, dest: string) => void;
}) {
  const drop = useDrop(path, onMove);
  return (
    <button
      {...drop}
      onClick={() => onSelect(path)}
      className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-sm text-left transition-colors
        ${drop.dragOver ? "bg-[var(--color-accent-dim)]/20 ring-1 ring-[var(--color-accent)] ring-inset" : active ? "bg-[var(--color-surface-hover)] text-[var(--color-text)]" : "text-[var(--color-text-dim)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"}`}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function SectionLabel({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  const cls = "text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] font-medium";
  return inline
    ? <span className={cls}>{children}</span>
    : <div className={`px-3 pt-3 pb-1 ${cls}`}>{children}</div>;
}

function IconAction({ title, onClick, danger, children }: {
  title: string; onClick: () => void; danger?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`px-1 text-xs rounded transition-colors hover:bg-[var(--color-surface-hover)]
        ${danger ? "hover:text-[var(--color-danger)]" : "hover:text-[var(--color-text)]"}`}
    >
      {children}
    </button>
  );
}
