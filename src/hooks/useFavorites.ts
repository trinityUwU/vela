// Gestion des favoris : pins libres + groupes, persistance automatique.
import { useCallback, useEffect, useState } from "react";
import * as fs from "../services/fs";
import type { Favorites, FavPin } from "../types";

const EMPTY: Favorites = { pins: [], groups: [] };

export function useFavorites() {
  const [favs, setFavs] = useState<Favorites>(EMPTY);

  useEffect(() => {
    fs.loadFavorites().then(setFavs).catch(() => setFavs(EMPTY));
  }, []);

  const persist = useCallback((next: Favorites) => {
    setFavs(next);
    fs.saveFavorites(next).catch(console.error);
  }, []);

  const pinPath = useCallback((path: string, name: string, groupIdx?: number) => {
    setFavs((prev) => {
      const pin: FavPin = { name, path };
      let next: Favorites;
      if (groupIdx !== undefined) {
        const groups = prev.groups.map((g, i) =>
          i === groupIdx && !g.pins.some((p) => p.path === path)
            ? { ...g, pins: [...g.pins, pin] }
            : g,
        );
        next = { ...prev, groups };
      } else {
        if (prev.pins.some((p) => p.path === path)) return prev;
        next = { ...prev, pins: [...prev.pins, pin] };
      }
      fs.saveFavorites(next).catch(console.error);
      return next;
    });
  }, []);

  const unpin = useCallback((path: string, groupIdx?: number) => {
    setFavs((prev) => {
      let next: Favorites;
      if (groupIdx !== undefined) {
        const groups = prev.groups.map((g, i) =>
          i === groupIdx ? { ...g, pins: g.pins.filter((p) => p.path !== path) } : g,
        );
        next = { ...prev, groups };
      } else {
        next = { ...prev, pins: prev.pins.filter((p) => p.path !== path) };
      }
      fs.saveFavorites(next).catch(console.error);
      return next;
    });
  }, []);

  const addGroup = useCallback((name: string) => {
    setFavs((prev) => {
      const next = { ...prev, groups: [...prev.groups, { name, pins: [], collapsed: false }] };
      fs.saveFavorites(next).catch(console.error);
      return next;
    });
  }, []);

  const removeGroup = useCallback((idx: number) => {
    setFavs((prev) => {
      const groups = prev.groups.filter((_, i) => i !== idx);
      const next = { ...prev, groups };
      fs.saveFavorites(next).catch(console.error);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((idx: number) => {
    setFavs((prev) => {
      const groups = prev.groups.map((g, i) =>
        i === idx ? { ...g, collapsed: !g.collapsed } : g,
      );
      const next = { ...prev, groups };
      fs.saveFavorites(next).catch(console.error);
      return next;
    });
  }, []);

  const renameFavPin = useCallback((path: string, newName: string, groupIdx?: number) => {
    setFavs((prev) => {
      let next: Favorites;
      if (groupIdx !== undefined) {
        const groups = prev.groups.map((g, i) =>
          i === groupIdx
            ? { ...g, pins: g.pins.map((p) => (p.path === path ? { ...p, name: newName } : p)) }
            : g,
        );
        next = { ...prev, groups };
      } else {
        next = { ...prev, pins: prev.pins.map((p) => (p.path === path ? { ...p, name: newName } : p)) };
      }
      fs.saveFavorites(next).catch(console.error);
      return next;
    });
  }, []);

  return { favs, pinPath, unpin, addGroup, removeGroup, toggleGroup, renameFavPin, persist };
}
