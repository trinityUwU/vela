import { describe, expect, test } from "bun:test";
import { matchPattern, archiveStem, parentDir, baseName } from "./path-util";

describe("matchPattern", () => {
  test("glob extension", () => {
    expect(matchPattern("photo.png", "*.png")).toBe(true);
    expect(matchPattern("photo.jpg", "*.png")).toBe(false);
  });
  test("glob casse ignorée", () => {
    expect(matchPattern("PHOTO.PNG", "*.png")).toBe(true);
  });
  test("glob ? = un caractère", () => {
    expect(matchPattern("a.txt", "?.txt")).toBe(true);
    expect(matchPattern("ab.txt", "?.txt")).toBe(false);
  });
  test("préfixe", () => {
    expect(matchPattern("IMG_001.jpg", "IMG_*")).toBe(true);
    expect(matchPattern("DSC_001.jpg", "IMG_*")).toBe(false);
  });
  test("point littéral", () => {
    expect(matchPattern("axtxt", "*.txt")).toBe(false);
  });
  test("regex /.../", () => {
    expect(matchPattern("draft-3", "/^draft/i")).toBe(true);
    expect(matchPattern("final", "/^draft/i")).toBe(false);
  });
  test("regex invalide → false", () => {
    expect(matchPattern("x", "/[/")).toBe(false);
  });
  test("vide → false", () => {
    expect(matchPattern("x", "  ")).toBe(false);
  });
});

describe("archiveStem", () => {
  test("composé tar.gz", () => expect(archiveStem("a.tar.gz")).toBe("a"));
  test("simple", () => expect(archiveStem("a.zip")).toBe("a"));
});

describe("parentDir / baseName", () => {
  test("parentDir", () => expect(parentDir("/a/b/c")).toBe("/a/b"));
  test("baseName", () => expect(baseName("/a/b/c")).toBe("c"));
});
