// Rendu de la zone centrale piloté par le profil actif : place chaque panneau selon les zones.
import { useRef, useState } from "react";
import type { DirEntry, PanelId, Zones } from "../types";
import type { SortBy, SortState } from "../hooks/useSort";
import type { useFavorites } from "../hooks/useFavorites";
import type { Place } from "../types";
import { Sidebar } from "./Sidebar";
import { FileGrid } from "./FileGrid";
import { FileTable } from "./FileTable";
import { FileList } from "./FileList";
import { EditorArea } from "./EditorArea";
import { FileTree } from "./FileTree";
import { TerminalPanel } from "./TerminalPanel";
import { ResizeHandle } from "./ResizeHandle";
import { GitPanel } from "./GitPanel";
import { TwinBar } from "./TwinBar";
import type { GitState } from "../hooks/useGitStatus";
import type { TermTab } from "../hooks/useTerminals";

type Favs = ReturnType<typeof useFavorites>;

interface FileTreeProps {
  rootPath: string;
  cwd: string;
  onNavigate: (path: string) => void;
  showHidden: boolean;
  onError: (e: string) => void;
}

interface TerminalProps {
  tabs: TermTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onNewShell: (shell: string) => void;
  shells: string[];
  onClose: (id: string) => void;
  onExit: (id: string) => void;
  onFollow: () => void;
  onHide: () => void;
  onRename: (id: string, title: string) => void;
  onSetColor: (id: string, color: string) => void;
  onOpenPath: (path: string, isDir: boolean) => void;
  onOpenUrl: (url: string) => void;
}

export interface ListingProps {
  entries: DirEntry[];
  selection: Set<string>;
  active: string | null;
  sort: SortState;
  onToggleBy: (by: SortBy) => void;
  onSelect: (entry: DirEntry, e: React.MouseEvent) => void;
  onSelectEdit: (entry: DirEntry, e: React.MouseEvent) => void;
  onOpen: (entry: DirEntry) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
  onContextBg: (e: React.MouseEvent) => void;
  onClearBg: () => void;
  onMove: (src: string, destDir: string) => void;
  folderSizes: Record<string, number>;
  colorOf: (path: string) => string | undefined;
  gitOf?: (path: string) => string | undefined;
  onColumns: (cols: number) => void;
}

interface EditorProps {
  tabs: DirEntry[];
  activePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onError: (msg: string) => void;
  onContext: (e: React.MouseEvent, entry: DirEntry) => void;
  colorOf: (path: string) => string | undefined;
  editPath: string | null;
}

interface SidebarProps {
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
  onOpenDownload: () => void;
}

interface ZoneLayoutProps {
  zones: Zones;
  view: "grid" | "list";
  editorActive: boolean;
  listing: ListingProps;
  editor: EditorProps;
  sidebar: SidebarProps;
  filetree: FileTreeProps;
  terminal: TerminalProps;
  git: { state: GitState; cwd: string; onError: (msg: string) => void; onOpenFile: (path: string) => void; onDiff: (path: string) => void };
  centerOverride?: React.ReactNode;
  listingB?: ListingProps; // volet jumeau (F03) : 2e listing indépendant
  activePane?: "a" | "b";
  onActivatePane?: (p: "a" | "b") => void;
  twin?: { selectionCount: number; onCopy: () => void; onMove: () => void; onSync: () => void };
}

function ListingPanel({ view, editorActive, p }: {
  view: "grid" | "list"; editorActive: boolean; p: ListingProps;
}): React.ReactElement {
  if (editorActive) {
    return (
      <FileList
        entries={p.entries} selection={p.selection} active={p.active}
        onSelect={p.onSelectEdit} onOpen={p.onOpen} onContext={p.onContext}
        onContextBg={p.onContextBg} onMove={p.onMove} colorOf={p.colorOf} gitOf={p.gitOf}
      />
    );
  }
  if (view === "list") {
    return (
      <FileTable
        entries={p.entries} selection={p.selection} active={p.active} sort={p.sort}
        onToggleBy={p.onToggleBy} onSelect={p.onSelect} onOpen={p.onOpen}
        onContext={p.onContext} onContextBg={p.onContextBg} onClearBg={p.onClearBg}
        onMove={p.onMove} folderSizes={p.folderSizes} colorOf={p.colorOf} gitOf={p.gitOf}
      />
    );
  }
  return (
    <FileGrid
      entries={p.entries} selection={p.selection} active={p.active}
      onSelect={p.onSelect} onOpen={p.onOpen} onContext={p.onContext}
      onContextBg={p.onContextBg} onClearBg={p.onClearBg} onMove={p.onMove}
      onColumns={p.onColumns} colorOf={p.colorOf} gitOf={p.gitOf}
    />
  );
}

function renderPanel(panel: PanelId, props: ZoneLayoutProps): React.ReactElement | null {
  switch (panel) {
    case "sidebar":
      return <Sidebar {...props.sidebar} />;
    case "listing":
      return <ListingPanel view={props.view} editorActive={props.editorActive} p={props.listing} />;
    case "editor":
      return <EditorArea {...props.editor} />;
    case "filetree":
      return <FileTree {...props.filetree} />;
    case "terminal":
      return <TerminalPanel {...props.terminal} />;
    case "git":
      return <GitPanel git={props.git.state} cwd={props.git.cwd} onError={props.git.onError} onOpenFile={props.git.onOpenFile} onDiff={props.git.onDiff} />;
    default:
      return null;
  }
}

export function ZoneLayout(props: ZoneLayoutProps): React.ReactElement {
  const { zones, centerOverride } = props;
  // Zone bottom redimensionnable (drag) — même mécanique que le dock terminal legacy.
  const [bottomH, setBottomH] = useState(256);
  const resizeBottom = (dy: number): void =>
    setBottomH((h) => Math.max(120, Math.min(window.innerHeight - 160, h - dy)));

  // Mode volet jumeau : center = volet A, right = volet B, séparés par un splitter draggable.
  const dual = !!props.listingB && !centerOverride;
  const [splitPct, setSplitPct] = useState(50);
  const dualRef = useRef<HTMLDivElement>(null);
  const resizeSplit = (dx: number): void =>
    setSplitPct((pct) => {
      const w = dualRef.current?.clientWidth ?? 1;
      return Math.max(20, Math.min(80, pct + (dx / w) * 100));
    });

  const paneBox = (which: "a" | "b", style: React.CSSProperties): React.ReactElement => {
    const p = which === "a" ? props.listing : props.listingB!;
    const isActive = props.activePane === which;
    return (
      <div
        key={which}
        style={style}
        onMouseDownCapture={() => props.onActivatePane?.(which)}
        className={`relative flex min-h-0 min-w-0 overflow-hidden ${isActive ? "ring-1 ring-inset ring-[var(--color-accent)]" : ""}`}
      >
        <ListingPanel view={props.view} editorActive={props.editorActive} p={p} />
      </div>
    );
  };

  const render = (panel: PanelId | null): React.ReactElement | null =>
    panel ? renderPanel(panel, props) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {dual && props.twin && (
        <TwinBar
          active={props.activePane ?? "a"}
          selectionCount={props.twin.selectionCount}
          onCopy={props.twin.onCopy}
          onMove={props.twin.onMove}
          onSync={props.twin.onSync}
        />
      )}
      <div className="flex-1 flex min-h-0">
        {dual ? (
          <>
            {render(zones.left)}
            <div ref={dualRef} className="flex-1 flex min-h-0 min-w-0">
              {paneBox("a", { flexBasis: `${splitPct}%`, flexGrow: 0, flexShrink: 0 })}
              <ResizeHandle orientation="vertical" onResize={resizeSplit} />
              {paneBox("b", { flexGrow: 1, flexShrink: 1, flexBasis: 0 })}
            </div>
          </>
        ) : (
          <>
            {render(zones.left)}
            {centerOverride
              ? <div className="relative flex-1 flex min-h-0">{centerOverride}</div>
              : render(zones.center)}
            {render(zones.right)}
          </>
        )}
      </div>
      {zones.bottom && (
        <div className="shrink-0 flex flex-col" style={{ height: bottomH }}>
          <ResizeHandle onResize={resizeBottom} />
          <div className="flex-1 min-h-0">{renderPanel(zones.bottom, props)}</div>
        </div>
      )}
    </div>
  );
}
