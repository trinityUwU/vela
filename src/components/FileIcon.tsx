// Icône d'une entrée : logo de langage (devicon) si reconnu, sinon icône générique sobre.
import python from "devicon/icons/python/python-original.svg";
import javascript from "devicon/icons/javascript/javascript-original.svg";
import typescript from "devicon/icons/typescript/typescript-original.svg";
import react from "devicon/icons/react/react-original.svg";
import rust from "devicon/icons/rust/rust-original.svg";
import go from "devicon/icons/go/go-original.svg";
import ruby from "devicon/icons/ruby/ruby-original.svg";
import php from "devicon/icons/php/php-original.svg";
import java from "devicon/icons/java/java-original.svg";
import kotlin from "devicon/icons/kotlin/kotlin-original.svg";
import swift from "devicon/icons/swift/swift-original.svg";
import html5 from "devicon/icons/html5/html5-original.svg";
import css3 from "devicon/icons/css3/css3-original.svg";
import sass from "devicon/icons/sass/sass-original.svg";
import markdown from "devicon/icons/markdown/markdown-original.svg";
import json from "devicon/icons/json/json-original.svg";
import c from "devicon/icons/c/c-original.svg";
import cpp from "devicon/icons/cplusplus/cplusplus-original.svg";
import bash from "devicon/icons/bash/bash-original.svg";
import vue from "devicon/icons/vuejs/vuejs-original.svg";
import type { DirEntry } from "../types";

const LOGO: Record<string, string> = {
  py: python, pyi: python, pyw: python,
  js: javascript, mjs: javascript, cjs: javascript,
  jsx: react, tsx: react,
  ts: typescript,
  rs: rust, go, rb: ruby, php, java,
  kt: kotlin, kts: kotlin, swift,
  html: html5, htm: html5,
  css: css3, scss: sass, sass,
  md: markdown, markdown,
  json, jsonc: json,
  c, h: c, cpp, cc: cpp, cxx: cpp, hpp: cpp,
  sh: bash, bash, zsh: bash,
  vue,
};

// Logos monochromes sombres : invertis pour rester lisibles sur fond sombre.
const DARK = new Set([rust, markdown, json, bash]);

const ARCHIVE = new Set(["zip", "tar", "gz", "tgz", "rar", "7z", "xz", "bz2", "zst"]);
const IMAGE = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);

interface Props {
  entry: DirEntry;
  size?: number;
}

export function FileIcon({ entry, size = 32 }: Props) {
  if (entry.is_dir) return <FolderGlyph size={size} />;

  const logo = LOGO[entry.extension];
  if (logo) {
    return (
      <img
        src={logo}
        width={size}
        height={size}
        alt=""
        draggable={false}
        style={DARK.has(logo) ? { filter: "invert(1) brightness(1.6)" } : undefined}
      />
    );
  }
  if (IMAGE.has(entry.extension)) return <ImageGlyph size={size} />;
  if (ARCHIVE.has(entry.extension)) return <ArchiveGlyph size={size} />;
  if (entry.extension === "pdf") return <PdfGlyph size={size} />;
  return <DocGlyph size={size} />;
}

// --- Génériques sobres (duotone discret) ---

export function FolderGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M3 7a2 2 0 0 1 2-2h3.4a2 2 0 0 1 1.4.6L11 7h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        fill="var(--color-accent)" opacity="0.85" />
    </svg>
  );
}

export function DocGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--color-surface-hover)" />
      <path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="var(--color-text-dim)" strokeWidth="1.4" />
      <path d="M8 12h8M8 15h8M8 18h5" stroke="var(--color-text-dim)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function ImageGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="16" rx="2" fill="var(--color-surface-hover)" />
      <circle cx="8.5" cy="9" r="1.6" fill="#7bd88f" />
      <path d="m4 18 5-5 4 3 3-2 4 4" stroke="#7bd88f" strokeWidth="1.4" fill="none" strokeLinejoin="round" />
    </svg>
  );
}

function ArchiveGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M5 4h14v4H5z" fill="var(--color-text-dim)" opacity="0.5" />
      <path d="M6 8h12v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" fill="var(--color-surface-hover)" />
      <path d="M11 8h2v3h-2zM11 12h2v2h-2z" fill="var(--color-text-dim)" />
    </svg>
  );
}

function PdfGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3h8l5 5v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" fill="var(--color-surface-hover)" />
      <path d="M14 3v4a1 1 0 0 0 1 1h4" stroke="var(--color-text-dim)" strokeWidth="1.4" />
      <text x="12" y="17" textAnchor="middle" fontSize="6" fontWeight="700" fill="var(--color-danger)">PDF</text>
    </svg>
  );
}
