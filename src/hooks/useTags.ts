// État des étiquettes couleur : chargement initial + application optimiste à une sélection.
import { useCallback, useEffect, useState } from "react";
import { loadTags, setTag } from "../services/tags";

export function useTags() {
  const [tags, setTags] = useState<Record<string, string>>({});

  useEffect(() => { loadTags().then(setTags).catch(() => {}); }, []);

  const setColor = useCallback(async (paths: string[], color: string) => {
    setTags((prev) => {
      const next = { ...prev };
      for (const p of paths) {
        if (color) next[p] = color;
        else delete next[p];
      }
      return next;
    });
    try {
      await setTag(paths, color);
    } catch { /* persistance best-effort */ }
  }, []);

  const colorOf = useCallback((path: string): string | undefined => tags[path], [tags]);

  return { colorOf, setColor };
}
