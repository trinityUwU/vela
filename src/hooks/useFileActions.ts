// Exécution des actions intelligentes (PDF/CSV/rangement) et de l'OCR, extraites d'App.tsx.
import { useCallback } from "react";
import type { DirEntry } from "../types";
import type { SmartActionId } from "../services/smart-actions";
import { imagesToPdf } from "../services/convert";
import { mergeCsv, organizeDir } from "../services/actions";
import { ocrCapabilities, ocrExtract } from "../services/ocr";
import { writeFile } from "../services/fs";

interface Deps {
  setError: (msg: string) => void;
  refresh: () => void;
  pushUndo: (entry: { kind: "move"; moves: { from: string; to: string }[] }) => void;
}

export function useFileActions({ setError, refresh, pushUndo }: Deps) {
  const runSmartAction = useCallback((id: SmartActionId, sel: DirEntry[]) => {
    const paths = sel.map((e) => e.path);
    if (id === "images-to-pdf") imagesToPdf(paths).then(refresh).catch((e) => setError(String(e)));
    else if (id === "merge-csv") mergeCsv(paths).then(refresh).catch((e) => setError(String(e)));
    else if (sel[0]?.is_dir) {
      organizeDir(sel[0].path, id === "organize-type" ? "type" : "date")
        .then((moves) => { pushUndo({ kind: "move", moves }); refresh(); }).catch((e) => setError(String(e)));
    }
  }, [setError, refresh, pushUndo]);

  const runOcr = useCallback((path: string) => {
    ocrCapabilities().then((c) => {
      if (!c.tesseract) { setError("tesseract non installé (sudo pacman -S tesseract tesseract-data-fra)"); return; }
      const lang = ["fra", "eng"].filter((l) => c.langs.includes(l)).join("+") || c.langs[0] || "eng";
      const out = path.replace(/\.[^.]+$/, "") + ".ocr.txt";
      ocrExtract(path, lang).then((text) => writeFile(out, text)).then(refresh).catch((e) => setError(String(e)));
    }).catch((e) => setError(String(e)));
  }, [setError, refresh]);

  return { runSmartAction, runOcr };
}
