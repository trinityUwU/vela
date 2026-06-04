// Registre d'actions de la palette Ctrl+K. Source unique : généré depuis les handlers d'App.
import { useMemo } from "react";
import type { Place, Profile } from "../types";

export type CommandGroup = "Actions" | "Navigation" | "Lieux" | "Profils";

export interface Command {
  id: string;
  title: string;
  hint?: string;
  group: CommandGroup;
  run: () => void;
}

export interface CommandContext {
  refresh: () => void;
  toggleHidden: () => void;
  goUp: () => void;
  goBack: () => void;
  goForward: () => void;
  navigate: (path: string) => void;
  switchProfile: (id: string) => void;
  places: Place[];
  profiles: Profile[];
  activeProfileId: string;
  openTerminal: () => void;
  openSettings: () => void;
  openProfileEditor: () => void;
  openDownload: () => void;
  openBrowser: () => void;
  openSearch: () => void;
  openCodeSearch: () => void;
  openTranslator: () => void;
  newFile: () => void;
  newFolder: () => void;
  newTab: () => void;
  closeTab: () => void;
  emptyTrash: () => void;
  selectByPattern: () => void;
  invertSelection: () => void;
  hashSelected: () => void;
}

export function useCommandRegistry(ctx: CommandContext): Command[] {
  return useMemo(() => {
    const actions: Command[] = [
      { id: "new-file", title: "Nouveau fichier", group: "Actions", run: ctx.newFile },
      { id: "new-folder", title: "Nouveau dossier", group: "Actions", run: ctx.newFolder },
      { id: "new-tab", title: "Nouvel onglet", hint: "Ctrl+T", group: "Navigation", run: ctx.newTab },
      { id: "close-tab", title: "Fermer l'onglet", hint: "Ctrl+W", group: "Navigation", run: ctx.closeTab },
      { id: "terminal", title: "Ouvrir un terminal", group: "Actions", run: ctx.openTerminal },
      { id: "download", title: "Télécharger… (YouTube / Spotify)", group: "Actions", run: ctx.openDownload },
      { id: "browser", title: "Ouvrir le navigateur", group: "Actions", run: ctx.openBrowser },
      { id: "search", title: "Rechercher", hint: "Ctrl+F", group: "Actions", run: ctx.openSearch },
      { id: "code-search", title: "Recherche de code (CodeIndex)", group: "Actions", run: ctx.openCodeSearch },
      { id: "translator", title: "Traducteur (texte / fichier)", group: "Actions", run: ctx.openTranslator },
      { id: "settings", title: "Réglages", group: "Actions", run: ctx.openSettings },
      { id: "profiles", title: "Éditer les profils", group: "Actions", run: ctx.openProfileEditor },
      { id: "empty-trash", title: "Vider la corbeille", group: "Actions", run: ctx.emptyTrash },
      { id: "nav-up", title: "Dossier parent", hint: "Alt+↑", group: "Navigation", run: ctx.goUp },
      { id: "nav-back", title: "Précédent", hint: "Alt+←", group: "Navigation", run: ctx.goBack },
      { id: "nav-forward", title: "Suivant", hint: "Alt+→", group: "Navigation", run: ctx.goForward },
      { id: "refresh", title: "Actualiser", hint: "F5", group: "Navigation", run: ctx.refresh },
      { id: "toggle-hidden", title: "Afficher / masquer les fichiers cachés", group: "Navigation", run: ctx.toggleHidden },
      { id: "select-pattern", title: "Sélectionner par motif…", hint: "*.png  /regex/", group: "Actions", run: ctx.selectByPattern },
      { id: "invert-selection", title: "Inverser la sélection", group: "Actions", run: ctx.invertSelection },
      { id: "hash", title: "Calculer une empreinte (hash)…", group: "Actions", run: ctx.hashSelected },
    ];
    const places: Command[] = ctx.places.map((p) => ({
      id: `place:${p.path}`,
      title: p.name,
      hint: p.path,
      group: "Lieux",
      run: () => ctx.navigate(p.path),
    }));
    const profiles: Command[] = ctx.profiles
      .filter((p) => p.id !== ctx.activeProfileId)
      .map((p) => ({
        id: `profile:${p.id}`,
        title: `Profil : ${p.name}`,
        group: "Profils",
        run: () => ctx.switchProfile(p.id),
      }));
    return [...actions, ...places, ...profiles];
  }, [ctx]);
}
