import { expect, test } from "bun:test";
import { smartActions } from "./smart-actions";
import type { DirEntry } from "../types";

const f = (name: string, ext: string, isDir = false): DirEntry =>
  ({ name, path: `/x/${name}`, is_dir: isDir, size: 0, modified: 0, extension: ext });

test("2 images → images-to-pdf", () => {
  expect(smartActions([f("a.png", "png"), f("b.jpg", "jpg")]).some((x) => x.id === "images-to-pdf")).toBe(true);
});

test("CSV → merge-csv", () => {
  expect(smartActions([f("a.csv", "csv"), f("b.csv", "csv")]).some((x) => x.id === "merge-csv")).toBe(true);
});

test("dossier seul → organize", () => {
  expect(smartActions([f("d", "", true)]).map((x) => x.id)).toContain("organize-type");
});

test("mélange image+csv → aucune action collective", () => {
  expect(smartActions([f("a.png", "png"), f("b.csv", "csv")]).length).toBe(0);
});
