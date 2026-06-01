// Chargement de contenu de fichier : édition complète si petit, lecture seule par chunks si volumineux.
import { useCallback, useEffect, useState } from "react";
import * as fs from "../services/fs";

const EDIT_MAX = 1024 * 1024; // ≤ 1 Mo : éditable d'un bloc
const CHUNK = 512 * 1024; // taille d'une tranche en lecture seule

interface State {
  content: string;
  offset: number;
  totalSize: number;
  eof: boolean;
  editable: boolean;
  loading: boolean;
}

const INIT: State = {
  content: "",
  offset: 0,
  totalSize: 0,
  eof: false,
  editable: false,
  loading: true,
};

export function useFileContent(path: string, size: number, onError: (m: string) => void) {
  const [st, setSt] = useState<State>(INIT);

  useEffect(() => {
    let alive = true;
    const editable = size <= EDIT_MAX;
    setSt({ ...INIT, editable });
    fs.readFileChunk(path, 0, editable ? EDIT_MAX : CHUNK)
      .then((c) => {
        if (!alive) return;
        setSt({
          content: c.content,
          offset: c.next_offset,
          totalSize: c.total_size,
          eof: c.eof,
          editable,
          loading: false,
        });
      })
      .catch((e) => alive && (onError(String(e)), setSt((s) => ({ ...s, loading: false }))));
    return () => {
      alive = false;
    };
  }, [path, size, onError]);

  const loadMore = useCallback(async () => {
    if (st.eof || st.loading) return;
    setSt((s) => ({ ...s, loading: true }));
    try {
      const c = await fs.readFileChunk(path, st.offset, CHUNK);
      setSt((s) => ({
        ...s,
        content: s.content + c.content,
        offset: c.next_offset,
        eof: c.eof,
        loading: false,
      }));
    } catch (e) {
      onError(String(e));
      setSt((s) => ({ ...s, loading: false }));
    }
  }, [path, st.offset, st.eof, st.loading, onError]);

  const setContent = useCallback((content: string) => {
    setSt((s) => ({ ...s, content }));
  }, []);

  return { ...st, loadMore, setContent };
}
