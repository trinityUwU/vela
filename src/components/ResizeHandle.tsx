// Poignée de redimensionnement vertical du panneau terminal (drag).
export function ResizeHandle({ onResize }: { onResize: (dy: number) => void }): React.ReactElement {
  const onMouseDown = (e: React.MouseEvent): void => {
    e.preventDefault();
    let last = e.clientY;
    const move = (ev: MouseEvent): void => { onResize(ev.clientY - last); last = ev.clientY; };
    const up = (): void => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  return (
    <div
      onMouseDown={onMouseDown}
      className="h-1 cursor-ns-resize bg-[var(--color-border)] hover:bg-[var(--color-accent)] shrink-0"
    />
  );
}
