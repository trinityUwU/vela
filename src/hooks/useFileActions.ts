// Exécution des actions intelligentes (PDF/CSV/rangement) et de l'OCR, extraites d'App.tsx.
import { useCallback } from "react";
import type { DirEntry } from "../types";
import type { SmartActionId } from "../services/smart-actions";
import { imagesToPdf } from "../services/convert";
import { mergeCsv, organizeDir } from "../services/actions";
import { ocrCapabilities, ocrExtract } from "../services/ocr";

interface Deps {
  setError: (msg: string) => void;
  refresh: () => void;
  pushUndo: (entry: { kind: "move"; moves: { from: string; to: string }[] }) => void;
  onMissingOcr: () => void;
}

export function useFileActions({ setError, refresh, pushUndo, onMissingOcr }: Deps) {
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
      if (!c.tesseract) { onMissingOcr(); return; }
      const lang = ["fra", "eng"].filter((l) => c.langs.includes(l)).join("+") || c.langs[0] || "eng";
      // Le backend écrit le sidecar .ocr.txt et émet la progression (panneau bas-droite).
      ocrExtract(path, lang).then(() => refresh()).catch((e) => setError(String(e)));
    }).catch((e) => setError(String(e)));
  }, [setError, refresh, onMissingOcr]);

  return { runSmartAction, runOcr };
}
