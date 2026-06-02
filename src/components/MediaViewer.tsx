// Lecteur média inline (vidéo / audio) : sert le fichier local via le protocole asset Tauri.
import { useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { DirEntry } from "../types";

interface Props {
  entry: DirEntry;
  kind: "video" | "audio";
}

export function MediaViewer({ entry, kind }: Props) {
  const [failed, setFailed] = useState(false);
  const src = convertFileSrc(entry.path);

  if (failed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 bg-[var(--color-bg)] text-sm text-[var(--color-text-dim)]">
        <span>Lecture impossible — codec non supporté par WebKitGTK.</span>
        <span className="text-xs">Installer les plugins GStreamer correspondants, ou ouvrir avec une app externe.</span>
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4 bg-[var(--color-bg)]">
      {kind === "video" ? (
        <video
          src={src}
          controls
          autoPlay={false}
          onError={() => setFailed(true)}
          className="max-w-full max-h-full rounded shadow-lg"
        />
      ) : (
        <div className="w-full max-w-lg flex flex-col items-center gap-4">
          <div className="text-sm text-[var(--color-text)] truncate w-full text-center">{entry.name}</div>
          <audio src={src} controls autoPlay={false} onError={() => setFailed(true)} className="w-full" />
        </div>
      )}
    </div>
  );
}
