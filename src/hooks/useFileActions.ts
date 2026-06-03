// Exécution des actions intelligentes (PDF/CSV/rangement) et de l'OCR, extraites d'App.tsx.
import { useCallback } from "react";
import type { DirEntry } from "../types";
import type { SmartActionId } from "../services/smart-actions";
import { imagesToPdf, convertFile } from "../services/convert";
import { mergeCsv, organizeDir } from "../services/actions";
import { ocrCapabilities, ocrExtract } from "../services/ocr";

interface InstallReq {
  label: string;
  cmd: string;
}

interface Deps {
  setError: (msg: string) => void;
  refresh: () => void;
  pushUndo: (entry: { kind: "move"; moves: { from: string; to: string }[] }) => void;
  onMissingTool: (req: InstallReq) => void;
}

const OCR_INSTALL: InstallReq = {
  label: "tesseract (OCR)",
  cmd: "sudo pacman -Syu --needed tesseract tesseract-data-fra tesseract-data-eng poppler",
};
const PDF_INSTALL: InstallReq = { label: "typst (PDF)", cmd: "sudo pacman -Syu --needed typst" };

export function useFileActions({ setError, refresh, pushUndo, onMissingTool }: Deps) {
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
      if (!c.tesseract) { onMissingTool(OCR_INSTALL); return; }
      const lang = ["fra", "eng"].filter((l) => c.langs.includes(l)).join("+") || c.langs[0] || "eng";
      // Le backend écrit le sidecar .ocr.txt et émet la progression (panneau bas-droite).
      ocrExtract(path, lang).then(() => refresh()).catch((e) => setError(String(e)));
    }).catch((e) => setError(String(e)));
  }, [setError, refresh, onMissingTool]);

  const runConvert = useCallback((path: string, target: string) => {
    convertFile(path, target).then(() => refresh()).catch((e) => {
      const msg = String(e);
      if (msg.includes("PDF_ENGINE_MISSING")) onMissingTool(PDF_INSTALL);
      else setError(msg);
    });
  }, [setError, refresh, onMissingTool]);

  return { runSmartAction, runOcr, runConvert };
}
