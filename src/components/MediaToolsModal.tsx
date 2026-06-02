// Dispatcher : route un fichier média vers le panneau d'outils image/audio/vidéo selon son type.
// `embedded` → rendu en HUD docké (sans backdrop centré) pour intégration dans l'Editor.
import { previewKind } from "../services/file-kind";
import { ImageToolsPanel } from "./ImageToolsPanel";
import { AudioToolsPanel } from "./AudioToolsPanel";
import { VideoToolsPanel } from "./VideoToolsPanel";

interface Props {
  path: string;
  ext: string;
  onClose: () => void;
  onError: (msg: string) => void;
  embedded?: boolean;
}

export function MediaToolsModal({ path, ext, onClose, onError, embedded = false }: Props): React.ReactElement | null {
  switch (previewKind(ext)) {
    case "image":
      return <ImageToolsPanel input={path} onError={onError} onClose={onClose} embedded={embedded} />;
    case "audio":
      return <AudioToolsPanel input={path} onError={onError} onClose={onClose} embedded={embedded} />;
    case "video":
      return <VideoToolsPanel input={path} onError={onError} onClose={onClose} embedded={embedded} />;
    default:
      return null;
  }
}
