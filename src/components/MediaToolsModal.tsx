// Dispatcher : route un fichier média vers le panneau d'outils image/audio/vidéo selon son type.
import { previewKind } from "../services/file-kind";
import { ImageToolsPanel } from "./ImageToolsPanel";
import { AudioToolsPanel } from "./AudioToolsPanel";
import { VideoToolsPanel } from "./VideoToolsPanel";

interface Props {
  path: string;
  ext: string;
  onClose: () => void;
  onError: (msg: string) => void;
}

export function MediaToolsModal({ path, ext, onClose, onError }: Props): React.ReactElement | null {
  switch (previewKind(ext)) {
    case "image":
      return <ImageToolsPanel input={path} onError={onError} onClose={onClose} />;
    case "audio":
      return <AudioToolsPanel input={path} onError={onError} onClose={onClose} />;
    case "video":
      return <VideoToolsPanel input={path} onError={onError} onClose={onClose} />;
    default:
      return null;
  }
}
