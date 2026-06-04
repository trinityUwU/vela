// Pile d'annulation (Ctrl+Z) des opérations fichiers réversibles : renommage, déplacement, copie, corbeille.
import { useCallback, useRef, useState } from "react";
import * as fs from "../services/fs";

export type UndoEntry =
  | { kind: "rename"; renames: { path: string; prevName: string }[] }
  | { kind: "move"; moves: { from: string; to: string }[] }
  | { kind: "copy"; created: string[] }
  | { kind: "trash"; originals: string[] }
  | { kind: "bulk-edit"; originals: { path: string; content: string }[] };

const MAX_STACK = 30;

function parentDir(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash > 0 ? path.slice(0, slash) : "/";
}

const LABELS: Record<UndoEntry["kind"], string> = {
  rename: "le renommage",
  move: "le déplacement",
  copy: "la copie",
  trash: "la mise à la corbeille",
  "bulk-edit": "le remplacement multi-fichiers",
};

// Exécute l'inverse d'une opération enregistrée.
async function revert(entry: UndoEntry): Promise<void> {
  switch (entry.kind) {
    case "rename":
      for (const r of entry.renames) await fs.renameEntry(r.path, r.prevName);
      return;
    case "move": {
      const byDir = new Map<string, string[]>();
      for (const m of entry.moves) {
        const dir = parentDir(m.from);
        (byDir.get(dir) ?? byDir.set(dir, []).get(dir)!).push(m.to);
      }
      for (const [dir, tos] of byDir) await fs.moveEntries(tos, dir);
      return;
    }
    case "copy":
      await fs.trashEntries(entry.created);
      return;
    case "trash":
      await fs.restoreTrash(entry.originals);
      return;
    case "bulk-edit":
      for (const o of entry.originals) await fs.writeFile(o.path, o.content);
      return;
  }
}

export function useUndo(onError: (msg: string) => void, onDone: () => void) {
  const stack = useRef<UndoEntry[]>([]);
  const [label, setLabel] = useState<string | null>(null);

  const sync = useCallback(() => {
    const top = stack.current[stack.current.length - 1];
    setLabel(top ? LABELS[top.kind] : null);
  }, []);

  const push = useCallback((entry: UndoEntry) => {
    stack.current.push(entry);
    if (stack.current.length > MAX_STACK) stack.current.shift();
    sync();
  }, [sync]);

  const undo = useCallback(async () => {
    const entry = stack.current.pop();
    sync();
    if (!entry) return;
    try {
      await revert(entry);
      onDone();
    } catch (e) {
      onError(String(e));
    }
  }, [onError, onDone, sync]);

  return { push, undo, label };
}
