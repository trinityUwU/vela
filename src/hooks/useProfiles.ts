// Gestion des profils de layout : profil actif résolu + persistance debounce.
import { useCallback, useEffect, useRef, useState } from "react";
import { loadProfiles, saveProfiles } from "../services/profiles";
import type { Profile, ProfilesState } from "../types";

const EMPTY: ProfilesState = { active: "", profiles: [] };
const DEBOUNCE_MS = 400;

interface UseProfilesResult {
  profiles: Profile[];
  active: Profile;
  activeId: string;
  setActive: (id: string) => void;
  updateActive: (patch: Partial<Profile>) => void;
  upsertProfile: (p: Profile) => void;
  removeProfile: (id: string) => void;
}

type SetState = React.Dispatch<React.SetStateAction<ProfilesState>>;
type Persist = (next: ProfilesState) => void;

function resolveActive(state: ProfilesState): Profile | undefined {
  return state.profiles.find((p) => p.id === state.active) ?? state.profiles[0];
}

function buildFallback(): Profile {
  return {
    id: "",
    name: "",
    zones: { left: null, center: "listing", right: null, bottom: null },
    filter_bar_hidden: false,
  };
}

function usePersist(setState: SetState): Persist {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return useCallback((next: ProfilesState) => {
    setState(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveProfiles(next).catch(console.error), DEBOUNCE_MS);
  }, [setState]);
}

interface Actions {
  setActive: (id: string) => void;
  updateActive: (patch: Partial<Profile>) => void;
  upsertProfile: (p: Profile) => void;
  removeProfile: (id: string) => void;
}

function applyActive(prev: ProfilesState, patch: Partial<Profile>): ProfilesState {
  const resolved = resolveActive(prev);
  if (!resolved) return prev;
  const profiles = prev.profiles.map((p) => (p.id === resolved.id ? { ...p, ...patch } : p));
  return { ...prev, profiles };
}

function applyUpsert(prev: ProfilesState, p: Profile): ProfilesState {
  const exists = prev.profiles.some((x) => x.id === p.id);
  const profiles = exists ? prev.profiles.map((x) => (x.id === p.id ? p : x)) : [...prev.profiles, p];
  return { ...prev, profiles };
}

function applyRemove(prev: ProfilesState, id: string): ProfilesState {
  const profiles = prev.profiles.filter((p) => p.id !== id);
  const active = prev.active === id ? profiles[0]?.id ?? "" : prev.active;
  return { active, profiles };
}

function useActions(setState: SetState, persist: Persist): Actions {
  const persistRef = useRef(persist);
  persistRef.current = persist;

  const run = useCallback((reduce: (prev: ProfilesState) => ProfilesState) => {
    setState((prev) => {
      const next = reduce(prev);
      if (next !== prev) persistRef.current(next);
      return next;
    });
  }, [setState]);

  return {
    setActive: useCallback((id) => run((prev) => ({ ...prev, active: id })), [run]),
    updateActive: useCallback((patch) => run((prev) => applyActive(prev, patch)), [run]),
    upsertProfile: useCallback((p) => run((prev) => applyUpsert(prev, p)), [run]),
    removeProfile: useCallback((id) => run((prev) => applyRemove(prev, id)), [run]),
  };
}

export function useProfiles(): UseProfilesResult {
  const [state, setState] = useState<ProfilesState>(EMPTY);
  const persist = usePersist(setState);
  const actions = useActions(setState, persist);

  useEffect(() => {
    loadProfiles().then(setState).catch(() => setState(EMPTY));
  }, []);

  const active = resolveActive(state) ?? buildFallback();

  return { profiles: state.profiles, active, activeId: active.id, ...actions };
}
