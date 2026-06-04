// Helpers markdown pour le studio (F13) : table des matières et statistiques de lecture.

export interface TocItem {
  level: number;
  text: string;
  line: number;
}

// Extrait les titres ATX (#, ##…) en ignorant les blocs de code ```.
export function buildToc(content: string): TocItem[] {
  const out: TocItem[] = [];
  let inFence = false;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) { inFence = !inFence; continue; }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) out.push({ level: m[1].length, text: m[2].replace(/#+\s*$/, "").trim(), line: i });
  }
  return out;
}

export interface MdStats {
  words: number;
  chars: number;
  readMin: number;
}

export function mdStats(content: string): MdStats {
  const chars = content.length;
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  return { words, chars, readMin: Math.max(1, Math.round(words / 200)) };
}
