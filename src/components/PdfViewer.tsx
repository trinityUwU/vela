// Aperçu PDF via pdf.js (worker local). Rendu page par page sur canvas, zoom, lazy au-delà de 20 pages.
import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import * as fs from "../services/fs";
import type { DirEntry } from "../types";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const LAZY_THRESHOLD = 20;

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function PdfViewer({ entry, onError }: { entry: DirEntry; onError: (m: string) => void }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.2);

  useEffect(() => {
    let cancelled = false;
    let task: ReturnType<typeof pdfjs.getDocument> | null = null;
    (async () => {
      try {
        const b64 = await fs.readFileBase64(entry.path);
        task = pdfjs.getDocument({ data: b64ToBytes(b64) });
        const loaded = await task.promise;
        if (cancelled) { task.destroy(); return; }
        setDoc(loaded);
      } catch (e) {
        if (!cancelled) onError(`PDF illisible : ${String(e)}`);
      }
    })();
    return () => { cancelled = true; task?.destroy(); setDoc(null); };
  }, [entry.path, onError]);

  if (!doc) {
    return <div className="flex-1 flex items-center justify-center text-sm text-[var(--color-text-dim)] bg-[var(--color-bg)]">Chargement du PDF…</div>;
  }

  const lazy = doc.numPages > LAZY_THRESHOLD;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[var(--color-bg)]">
      <div className="flex items-center gap-2 px-3 h-9 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <span className="text-[11px] text-[var(--color-text-dim)]">{doc.numPages} page{doc.numPages > 1 ? "s" : ""}</span>
        <div className="flex-1" />
        <ZoomBtn onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))}>−</ZoomBtn>
        <span className="text-[11px] text-[var(--color-text-dim)] w-10 text-center">{Math.round(scale * 100)}%</span>
        <ZoomBtn onClick={() => setScale((s) => Math.min(3, +(s + 0.2).toFixed(2)))}>+</ZoomBtn>
      </div>
      <div className="flex-1 overflow-auto p-4 flex flex-col items-center gap-4">
        {Array.from({ length: doc.numPages }, (_, i) => (
          <PdfPage key={i} doc={doc} pageNumber={i + 1} scale={scale} lazy={lazy} />
        ))}
      </div>
    </div>
  );
}

function PdfPage({ doc, pageNumber, scale, lazy }: {
  doc: PDFDocumentProxy; pageNumber: number; scale: number; lazy: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(!lazy);

  useEffect(() => {
    if (!lazy || visible) return;
    const el = canvasRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { rootMargin: "300px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [lazy, visible]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNumber);
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * dpr });
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || cancelled) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;
      await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    })();
    return () => { cancelled = true; };
  }, [doc, pageNumber, scale, visible]);

  return (
    <canvas
      ref={canvasRef}
      className="shadow-lg rounded bg-white"
      style={{ minHeight: visible ? undefined : 400, minWidth: 300 }}
    />
  );
}

function ZoomBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-6 h-6 flex items-center justify-center rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]">
      {children}
    </button>
  );
}
