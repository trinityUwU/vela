// Cluster des modales/overlays de features (vagues 3.1/3.2) extrait de App pour alléger l'assemblage.
// Chaque overlay est monté conditionnellement selon l'état passé par App ; aucune logique métier ici.
import { TemplatePicker } from "./TemplatePicker";
import { SharePanel } from "./SharePanel";
import { PdfTools } from "./PdfTools";
import { ImageAnnotate } from "./ImageAnnotate";
import { VideoTools } from "./VideoTools";
import { ImageBatch } from "./ImageBatch";
import { Lightbox } from "./Lightbox";
import { AdvancedSearch } from "./AdvancedSearch";
import { FindReplace } from "./FindReplace";
import { QuickLook } from "./QuickLook";
import { HashModal } from "./HashModal";
import { HexViewer } from "./HexViewer";
import { ConflictModal } from "./ConflictModal";
import { ExtractConflictModal } from "./ExtractConflictModal";
import { InputModal } from "./InputModal";
import type { DirEntry } from "../types";
import type { Conflict, ConflictResolution } from "../services/fs";
import type { SearchCriteria } from "../services/advsearch";

export interface FeatureOverlaysProps {
  templatePick: boolean;
  onTemplatePick: (name: string) => void;
  closeTemplatePick: () => void;

  sharePaths: string[] | null;
  closeShare: () => void;

  pdfPaths: string[] | null;
  closePdf: (resultPath?: string) => void;

  annotatePath: string | null;
  closeAnnotate: (savedPath?: string) => void;

  videoToolsPath: string | null;
  closeVideoTools: (outPath?: string) => void;

  batchImages: string[] | null;
  closeBatch: (outDir?: string) => void;

  galleryImages: DirEntry[];
  galleryIndex: number | null;
  closeGallery: () => void;

  advSearch: { criteria: SearchCriteria; autoRun: boolean } | null;
  onReveal: (path: string) => void;
  onSaveSmart: (c: SearchCriteria) => void;
  closeAdvSearch: () => void;

  smartName: SearchCriteria | null;
  onSaveSmartName: (name: string, criteria: SearchCriteria) => void;
  closeSmartName: () => void;

  findReplaceRoot: string | null;
  onApplied: (originals: { path: string; content: string }[], summary: string) => void;
  closeFindReplace: () => void;

  quickLook: DirEntry | null;
  closeQuickLook: () => void;

  hashPath: string | null;
  closeHash: () => void;

  hexPath: string | null;
  closeHex: () => void;

  conflictReq: { conflicts: Conflict[]; resolve: (r: Record<string, ConflictResolution> | null) => void } | null;
  resolveConflict: (r: Record<string, ConflictResolution> | null) => void;

  extractConflict: { archivePath: string; dest: string } | null;
  onExtractReplace: () => void;
  onExtractKeepBoth: () => void;
  closeExtractConflict: () => void;

  onError: (msg: string) => void;
}

export function FeatureOverlays(p: FeatureOverlaysProps): React.ReactElement {
  return (
    <>
      {p.templatePick && <TemplatePicker onPick={p.onTemplatePick} onClose={p.closeTemplatePick} />}

      {p.sharePaths && <SharePanel paths={p.sharePaths} onClose={p.closeShare} onError={p.onError} />}

      {p.pdfPaths && (
        <PdfTools paths={p.pdfPaths} onDone={(r) => p.closePdf(r)} onClose={() => p.closePdf()} onError={p.onError} />
      )}

      {p.annotatePath && (
        <ImageAnnotate path={p.annotatePath} onSaved={(s) => p.closeAnnotate(s)} onClose={() => p.closeAnnotate()} onError={p.onError} />
      )}

      {p.videoToolsPath && (
        <VideoTools path={p.videoToolsPath} onDone={(o) => p.closeVideoTools(o)} onClose={() => p.closeVideoTools()} onError={p.onError} />
      )}

      {p.batchImages && (
        <ImageBatch paths={p.batchImages} onDone={(d) => p.closeBatch(d)} onClose={() => p.closeBatch()} onError={p.onError} />
      )}

      {p.galleryIndex !== null && p.galleryImages.length > 0 && (
        <Lightbox images={p.galleryImages} index={p.galleryIndex} onClose={p.closeGallery} onError={p.onError} />
      )}

      {p.advSearch && (
        <AdvancedSearch
          initial={p.advSearch.criteria}
          autoRun={p.advSearch.autoRun}
          onReveal={p.onReveal}
          onSave={p.onSaveSmart}
          onClose={p.closeAdvSearch}
          onError={p.onError}
        />
      )}

      {p.smartName && (
        <InputModal
          title="Enregistrer le dossier intelligent"
          confirmLabel="Enregistrer"
          placeholder="Nom de la recherche"
          onSubmit={(name) => p.onSaveSmartName(name, p.smartName!)}
          onCancel={p.closeSmartName}
        />
      )}

      {p.findReplaceRoot && (
        <FindReplace root={p.findReplaceRoot} onApplied={p.onApplied} onClose={p.closeFindReplace} onError={p.onError} />
      )}

      {p.quickLook && <QuickLook entry={p.quickLook} onClose={p.closeQuickLook} onError={p.onError} />}

      {p.hashPath && <HashModal path={p.hashPath} onClose={p.closeHash} onError={p.onError} />}

      {p.hexPath && <HexViewer path={p.hexPath} onClose={p.closeHex} onError={p.onError} />}

      {p.conflictReq && (
        <ConflictModal
          conflicts={p.conflictReq.conflicts}
          onResolve={(r) => p.resolveConflict(r)}
          onCancel={() => p.resolveConflict(null)}
        />
      )}

      {p.extractConflict && (
        <ExtractConflictModal
          dest={p.extractConflict.dest}
          onReplace={p.onExtractReplace}
          onKeepBoth={p.onExtractKeepBoth}
          onCancel={p.closeExtractConflict}
        />
      )}
    </>
  );
}
