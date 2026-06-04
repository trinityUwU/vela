// Rend les menus contextuels (fichier/sélection + zone vide) et leur câblage d'actions.
// Extrait d'App.tsx pour alléger l'assemblage principal ; ferme le menu après chaque action.
import type { DirEntry } from "../types";
import type { Dialog } from "./DialogHost";
import type { SmartActionId } from "../services/smart-actions";
import { ContextMenu } from "./ContextMenu";
import { BgContextMenu } from "./BgContextMenu";
import { archiveStem, parentDir, baseName } from "../services/path-util";

interface Props {
  menu: { x: number; y: number; entry: DirEntry } | null;
  bgMenu: { x: number; y: number } | null;
  cwd: string;
  selectionSize: number;
  showHidden: boolean;
  canPaste: boolean;
  selectedEntries: DirEntry[];
  cwdEntry: DirEntry;
  colorOf: (path: string) => string | undefined;
  onCloseMenu: () => void;
  onCloseBg: () => void;
  selPaths: (fallback?: string) => string[];
  openInEditor: (e: DirEntry) => void;
  openNewTab: (path: string) => void;
  openNative: (e: DirEntry) => void;
  copyToClipboard: (mode: "copy" | "cut", paths: string[]) => void;
  onDialog: (d: Dialog) => void;
  askTrash: (paths: string[]) => void;
  askDelete: (paths: string[]) => void;
  compareSelection: (fallback?: string) => void;
  setColor: (paths: string[], color: string) => void;
  openTerminalHere: (p: string) => void;
  computeSize: (p: string) => void;
  onAnalyze: (p: string) => void;
  onHash: (p: string) => void;
  onExtract: (archivePath: string, dest: string) => void;
  onMediaTools: (e: DirEntry) => void;
  onTranslate: (p: string) => void;
  runConvert: (path: string, target: string) => void;
  runOcr: (path: string) => void;
  runSmartAction: (id: SmartActionId, entries: DirEntry[]) => void;
  onError: (msg: string) => void;
  paste: () => void;
  refresh: () => void;
  toggleHidden: () => void;
  pinCurrent: () => void;
}

export function ContextMenus(props: Props): React.ReactElement {
  const { menu, bgMenu, onCloseMenu, onCloseBg, selPaths } = props;
  const fileEntries = (m: { entry: DirEntry }) =>
    props.selectedEntries.length ? props.selectedEntries : [m.entry];

  return (
    <>
      {menu && (
        <ContextMenu
          menu={{
            x: menu.x, y: menu.y, path: menu.entry.path, name: menu.entry.name,
            isDir: menu.entry.is_dir, extension: menu.entry.extension, cwd: props.cwd,
            count: props.selectionSize,
          }}
          onClose={onCloseMenu}
          onOpen={() => { props.openInEditor(menu.entry); onCloseMenu(); }}
          onOpenNewTab={() => { props.openNewTab(menu.entry.path); onCloseMenu(); }}
          onOpenNative={() => { props.openNative(menu.entry); onCloseMenu(); }}
          onRename={() => { props.onDialog({ kind: "rename", entry: menu.entry }); onCloseMenu(); }}
          onTrash={() => { props.askTrash(selPaths(menu.entry.path)); onCloseMenu(); }}
          onDeletePermanent={() => { props.askDelete(selPaths(menu.entry.path)); onCloseMenu(); }}
          onProperties={() => { props.onDialog({ kind: "props", entry: menu.entry }); onCloseMenu(); }}
          onCopy={() => { props.copyToClipboard("copy", selPaths(menu.entry.path)); onCloseMenu(); }}
          onCut={() => { props.copyToClipboard("cut", selPaths(menu.entry.path)); onCloseMenu(); }}
          onCompress={() => { props.onDialog({ kind: "compress", paths: selPaths(menu.entry.path) }); onCloseMenu(); }}
          onBatchRename={() => {
            props.onDialog({ kind: "batchrename", names: selPaths(menu.entry.path).map(baseName) });
            onCloseMenu();
          }}
          onCompare={() => { props.compareSelection(menu.entry.path); onCloseMenu(); }}
          onSetColor={(color) => props.setColor(selPaths(menu.entry.path), color)}
          currentColor={props.colorOf(menu.entry.path)}
          onOpenTerminal={() => { props.openTerminalHere(menu.entry.path); onCloseMenu(); }}
          onComputeSize={() => { props.computeSize(menu.entry.path); onCloseMenu(); }}
          onAnalyze={() => { props.onAnalyze(menu.entry.path); onCloseMenu(); }}
          onHash={() => { props.onHash(menu.entry.path); onCloseMenu(); }}
          onMediaTools={() => { props.onMediaTools(menu.entry); onCloseMenu(); }}
          onExtractHere={() => {
            const dest = `${parentDir(menu.entry.path)}/${archiveStem(menu.entry.name)}`;
            props.onExtract(menu.entry.path, dest);
            onCloseMenu();
          }}
          onExtractTo={() => {
            const defaultDest = `${parentDir(menu.entry.path)}/${archiveStem(menu.entry.name)}`;
            props.onDialog({ kind: "extractto", archivePath: menu.entry.path, defaultDest });
            onCloseMenu();
          }}
          onConvert={(target) => { props.runConvert(menu.entry.path, target); onCloseMenu(); }}
          onOcr={() => { props.runOcr(menu.entry.path); onCloseMenu(); }}
          onTranslate={() => { props.onTranslate(menu.entry.path); onCloseMenu(); }}
          entries={fileEntries(menu)}
          onSmartAction={(id) => { props.runSmartAction(id, fileEntries(menu)); onCloseMenu(); }}
        />
      )}

      {bgMenu && (
        <BgContextMenu
          x={bgMenu.x}
          y={bgMenu.y}
          showHidden={props.showHidden}
          canPaste={props.canPaste}
          onClose={onCloseBg}
          onNewFile={() => { props.onDialog({ kind: "newfile" }); onCloseBg(); }}
          onNewFolder={() => { props.onDialog({ kind: "newfolder" }); onCloseBg(); }}
          onPaste={() => { props.paste(); onCloseBg(); }}
          onRefresh={() => { props.refresh(); onCloseBg(); }}
          onToggleHidden={() => { props.toggleHidden(); onCloseBg(); }}
          onPinCurrent={() => { props.pinCurrent(); onCloseBg(); }}
          onProperties={() => { props.onDialog({ kind: "props", entry: props.cwdEntry }); onCloseBg(); }}
        />
      )}
    </>
  );
}
