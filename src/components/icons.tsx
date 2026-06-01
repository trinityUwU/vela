// Icônes SVG inline (zéro dépendance). Héritent de currentColor.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = {
  width: 18, height: 18, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

export const Folder = (p: P) => (
  <svg {...base} {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg>
);
export const File = (p: P) => (
  <svg {...base} {...p}><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M5 3h9l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /></svg>
);
export const Code = (p: P) => (
  <svg {...base} {...p}><path d="m16 18 4-6-4-6M8 6l-4 6 4 6" /></svg>
);
export const Image = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-5-5L5 21" /></svg>
);
export const ArrowUp = (p: P) => (
  <svg {...base} {...p}><path d="M12 19V5M5 12l7-7 7 7" /></svg>
);
export const Refresh = (p: P) => (
  <svg {...base} {...p}><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" /></svg>
);
export const Eye = (p: P) => (
  <svg {...base} {...p}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
);
export const FolderPlus = (p: P) => (
  <svg {...base} {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M12 11v4M10 13h4" /></svg>
);
export const Save = (p: P) => (
  <svg {...base} {...p}><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
);
export const Drive = (p: P) => (
  <svg {...base} {...p}><rect x="3" y="13" width="18" height="6" rx="2" /><path d="M5 13V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6" /><circle cx="8" cy="16" r="0.5" /></svg>
);
export const Home = (p: P) => (
  <svg {...base} {...p}><path d="M3 11l9-8 9 8" /><path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" /></svg>
);
