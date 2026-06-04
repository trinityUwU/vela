// Hôte des modales pilotées par l'état `dialog` d'App : rename, création, corbeille, compress, etc.
import type { DirEntry } from "../types";
import { InputModal } from "./InputModal";
import { ConfirmModal } from "./ConfirmModal";
import { PropertiesModal } from "./PropertiesModal";
import { CompressModal } from "./CompressModal";
import { BatchRenameModal } from "./BatchRenameModal";
import { startExtraction, type ArchiveFormat } from "../services/fs";

export type Dialog =
  | { kind: "rename"; entry: DirEntry }
  | { kind: "newfolder" }
  | { kind: "newfile" }
  | { kind: "trash"; paths: string[]; label: string }
  | { kind: "delete"; paths: string[]; label: string }
  | { kind: "props"; entry: DirEntry }
  | { kind: "compress"; paths: string[] }
  | { kind: "batchrename"; names: string[] }
  | { kind: "emptytrash" }
  | { kind: "extractto"; archivePath: string; defaultDest: string }
  | { kind: "selectpattern" }
  | null;

interface FmActions {
  cwd: string;
  rename: (path: string, name: string) => void;
  newFolder: (name: string) => void;
  createFile: (name: string) => void;
  trash: (paths: string[]) => void;
  deletePermanent: (paths: string[]) => void;
  compress: (paths: string[], dest: string, format: ArchiveFormat, password?: string) => void;
  renameMany: (dir: string, renames: { from: string; to: string }[]) => void;
  emptyTrash: () => void;
  setError: (msg: string | null) => void;
}

interface Props {
  dialog: Dialog;
  onClose: () => void;
  fm: FmActions;
  archiveStem: (name: string) => string;
  baseName: (path: string) => string;
}

export function DialogHost({ dialog, onClose, fm, archiveStem, baseName }: Props): React.ReactElement | null {
  if (!dialog) return null;
  switch (dialog.kind) {
    case "rename":
      return (
        <InputModal
          title="Renommer" initial={dialog.entry.name}
          onSubmit={(name) => { fm.rename(dialog.entry.path, name); onClose(); }}
          onCancel={onClose}
        />
      );
    case "newfolder":
      return (
        <InputModal
          title="Nouveau dossier" confirmLabel="Créer"
          onSubmit={(name) => { fm.newFolder(name); onClose(); }} onCancel={onClose}
        />
      );
    case "newfile":
      return (
        <InputModal
          title="Nouveau fichier" confirmLabel="Créer" placeholder="nom.txt"
          onSubmit={(name) => { fm.createFile(name); onClose(); }} onCancel={onClose}
        />
      );
    case "trash":
      return (
        <ConfirmModal
          message={`Mettre ${dialog.label} à la corbeille ?`}
          onConfirm={() => { fm.trash(dialog.paths); onClose(); }} onCancel={onClose}
        />
      );
    case "delete":
      return (
        <ConfirmModal
          message={`Supprimer définitivement ${dialog.label} ? Cette action est irréversible.`}
          onConfirm={() => { fm.deletePermanent(dialog.paths); onClose(); }} onCancel={onClose}
        />
      );
    case "props":
      return <PropertiesModal entry={dialog.entry} onClose={onClose} />;
    case "compress":
      return (
        <CompressModal
          count={dialog.paths.length}
          defaultName={dialog.paths.length === 1 ? archiveStem(baseName(dialog.paths[0])) : "archive"}
          onSubmit={(name, format, password) => { fm.compress(dialog.paths, `${fm.cwd}/${name}`, format, password); onClose(); }}
          onCancel={onClose}
        />
      );
    case "emptytrash":
      return (
        <ConfirmModal
          message="Vider la corbeille ? Tous les éléments seront supprimés définitivement."
          onConfirm={() => { fm.emptyTrash(); onClose(); }} onCancel={onClose}
        />
      );
    case "batchrename":
      return (
        <BatchRenameModal
          names={dialog.names}
          onSubmit={(renames) => { fm.renameMany(fm.cwd, renames); onClose(); }} onCancel={onClose}
        />
      );
    case "extractto":
      return (
        <InputModal
          title="Extraire vers…" confirmLabel="Extraire" initial={dialog.defaultDest}
          onSubmit={(dest) => {
            if (dest.trim()) startExtraction(dialog.archivePath, dest.trim()).catch((e) => fm.setError(String(e)));
            onClose();
          }}
          onCancel={onClose}
        />
      );
    default:
      return null;
  }
}
