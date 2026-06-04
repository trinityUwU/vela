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

// Teste un nom de fichier contre un motif : `/corps/flags` = regex, sinon glob (`*` et `?`, casse ignorée).
// Motif invalide ou vide → false (jamais d'exception propagée).
export function matchPattern(name: string, pattern: string): boolean {
  const p = pattern.trim();
  if (!p) return false;
  const re = /^\/(.+)\/([a-z]*)$/.exec(p);
  if (re) {
    try {
      return new RegExp(re[1], re[2]).test(name);
    } catch {
      return false;
    }
  }
  const glob = p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".");
  try {
    return new RegExp(`^${glob}$`, "i").test(name);
  } catch {
    return false;
  }
}
