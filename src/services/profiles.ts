// Wrappers typés autour des commandes Tauri de profils de layout.
import { invoke } from "@tauri-apps/api/core";
import type { ProfilesState } from "../types";

export async function loadProfiles(): Promise<ProfilesState> {
  return invoke("load_profiles");
}

export async function saveProfiles(profiles: ProfilesState): Promise<void> {
  return invoke("save_profiles", { profiles });
}
