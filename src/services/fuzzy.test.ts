import { expect, test } from "bun:test";
import { fuzzyScore, fuzzyMatch } from "./fuzzy";

test("query vide matche tout", () => {
  expect(fuzzyScore("", "n'importe quoi")).toBeGreaterThan(0);
});

test("subséquence trouvée", () => {
  expect(fuzzyMatch("trm", "Ouvrir un terminal")).toBe(true);
});

test("caractère absent → 0", () => {
  expect(fuzzyScore("xyz", "Réglages")).toBe(0);
});

test("début de mot mieux noté que milieu", () => {
  const debut = fuzzyScore("set", "settings");
  const milieu = fuzzyScore("set", "un asset divers");
  expect(debut).toBeGreaterThan(milieu);
});

test("match consécutif mieux noté qu'éparpillé dans un mot", () => {
  const consec = fuzzyScore("abc", "abc");
  const eparp = fuzzyScore("abc", "axbxc");
  expect(consec).toBeGreaterThan(eparp);
});
