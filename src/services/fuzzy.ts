// Matcher fuzzy par subséquence, sans dépendance. Score = bonus consécutif + début de mot + proximité.
const WORD_SEP = /[\s\-_./]/;

export function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  let qi = 0;
  let score = 0;
  let prev = -2;
  let first = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] !== q[qi]) continue;
    if (first < 0) first = ti;
    let bonus = 1;
    if (ti === prev + 1) bonus += 2;
    if (ti === 0 || WORD_SEP.test(t[ti - 1])) bonus += 3;
    score += bonus;
    prev = ti;
    qi++;
  }
  if (qi < q.length) return 0;
  return score + Math.max(0, 5 - first);
}

export function fuzzyMatch(query: string, target: string): boolean {
  return fuzzyScore(query, target) > 0;
}
