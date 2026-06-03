// Hôte des overlays plein écran conditionnels (Réglages, profils, téléchargement, diff, analyse).
// Extrait d'App.tsx pour tenir sous la limite de 500 lignes et laisser place à la palette.
import type { ComponentProps } from "react";
import { SettingsPanel } from "./SettingsPanel";
import { ProfileEditor } from "./ProfileEditor";
import { DownloadModal } from "./DownloadModal";
import { DiffViewer } from "./DiffViewer";
import { DirCompareViewer } from "./DirCompareViewer";
import { DiskAnalyzer } from "./DiskAnalyzer";
import { CommandPalette } from "./CommandPalette";

interface Props {
  settings: ComponentProps<typeof SettingsPanel> | null;
  profileEditor: ComponentProps<typeof ProfileEditor> | null;
  download: ComponentProps<typeof DownloadModal> | null;
  diff: ComponentProps<typeof DiffViewer> | null;
  dirDiff: ComponentProps<typeof DirCompareViewer> | null;
  analyzer: ComponentProps<typeof DiskAnalyzer> | null;
  palette: ComponentProps<typeof CommandPalette> | null;
}

export function OverlayHost({ settings, profileEditor, download, diff, dirDiff, analyzer, palette }: Props) {
  return (
    <>
      {palette && <CommandPalette {...palette} />}
      {settings && <SettingsPanel {...settings} />}
      {profileEditor && <ProfileEditor {...profileEditor} />}
      {download && <DownloadModal {...download} />}
      {diff && <DiffViewer {...diff} />}
      {dirDiff && <DirCompareViewer {...dirDiff} />}
      {analyzer && <DiskAnalyzer {...analyzer} />}
    </>
  );
}
