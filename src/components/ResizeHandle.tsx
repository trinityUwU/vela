// Poignée de redimensionnement par drag. Barre horizontale (drag vertical, dock terminal)
// ou barre verticale (drag horizontal, split des volets jumeaux). Reporte le delta sur l'axe de drag.
export function ResizeHandle({
  onResize,
  orientation = "horizontal",
}: {
  onResize: (delta: number) => void;
  orientation?: "horizontal" | "vertical";
}): React.ReactElement {
  const horizontal = orientation === "horizontal";
  const onMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault();
    let last = horizontal ? e.clientY : e.clientX;
    const move = (ev: MouseEvent): void => {
      const cur = horizontal ? ev.clientY : ev.clientX;
      onResize(cur - last);
      last = cur;
    };
    const up = (): void => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return (
    <div
      onMouseDown={onMouseDown}
      className={
        horizontal
          ? "h-1 cursor-ns-resize bg-[var(--color-border)] hover:bg-[var(--color-accent)] shrink-0"
          : "w-1 cursor-ew-resize bg-[var(--color-border)] hover:bg-[var(--color-accent)] shrink-0"
      }
    />
  );
}
