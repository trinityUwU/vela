// Classification des fichiers : éditable/texte, langage CodeMirror, type d'aperçu.
import type { Extension } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { javascript } from "@codemirror/lang-javascript";
import { markdown } from "@codemirror/lang-markdown";
import { json } from "@codemirror/lang-json";
import { rust } from "@codemirror/lang-rust";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";

export type Preview = "code" | "markdown" | "image" | "binary";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"]);

const TEXT_EXT = new Set([
  "txt", "md", "markdown", "log", "csv", "tsv",
  "py", "pyi", "js", "jsx", "ts", "tsx", "mjs", "cjs",
  "json", "jsonc", "rs", "toml", "yaml", "yml", "xml",
  "html", "htm", "css", "scss", "sass", "less",
  "sh", "bash", "zsh", "fish", "conf", "ini", "env", "cfg",
  "c", "h", "cpp", "hpp", "go", "rb", "php", "java", "kt", "swift",
  "sql", "lua", "vim", "dockerfile", "gitignore", "lock",
]);

export function previewKind(ext: string): Preview {
  if (ext === "md" || ext === "markdown") return "markdown";
  if (IMAGE_EXT.has(ext)) return "image";
  if (TEXT_EXT.has(ext)) return "code";
  return "binary";
}

export function isEditable(ext: string): boolean {
  const k = previewKind(ext);
  return k === "code" || k === "markdown";
}

export function langExtension(ext: string): Extension[] {
  switch (ext) {
    case "py":
    case "pyi":
      return [python()];
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return [javascript({ jsx: true })];
    case "ts":
    case "tsx":
      return [javascript({ jsx: true, typescript: true })];
    case "md":
    case "markdown":
      return [markdown()];
    case "json":
    case "jsonc":
      return [json()];
    case "rs":
      return [rust()];
    case "html":
    case "htm":
    case "xml":
      return [html()];
    case "css":
    case "scss":
    case "sass":
    case "less":
      return [css()];
    default:
      return [];
  }
}
