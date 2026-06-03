// Helpers de chemin partagés (extraits d'App.tsx).
const ARCHIVE_COMPOUNDS = [".tar.gz", ".tar.bz2", ".tar.xz", ".tar.zst", ".tar"];

export function archiveStem(name: string): string {
  for (const c of ARCHIVE_COMPOUNDS) {
    if (name.toLowerCase().endsWith(c)) return name.slice(0, -c.length);
  }
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function parentDir(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash > 0 ? path.slice(0, slash) : "/";
}

export function baseName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}
