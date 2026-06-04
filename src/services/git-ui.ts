// Couleurs et libellés de l'overlay git, partagés par les vues (FileTile/Table/List) et le GitPanel.
export const GIT_COLOR: Record<string, string> = {
  modified: "#e2b340",
  new: "#4caf50",
  deleted: "#e0524f",
  renamed: "#5b9bd5",
  ignored: "#6b7280",
  dir: "#8b8f98", // dossier contenant des changements (statut agrégé)
};

export const GIT_LABEL: Record<string, string> = {
  modified: "modifié",
  new: "nouveau",
  deleted: "supprimé",
  renamed: "renommé",
  ignored: "ignoré",
  dir: "contient des changements",
};

export function gitColor(status: string): string {
  return GIT_COLOR[status] ?? "#888";
}
