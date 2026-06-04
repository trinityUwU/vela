// Conteneur de menu flottant ancré sur un point (curseur) et rabattu dans le viewport.
import type { ReactNode } from "react";
import { useMenuPosition } from "../hooks/useMenuPosition";

interface Props {
  x: number;
  y: number;
  className?: string;
  children: ReactNode;
}

export function FloatingMenu({ x, y, className = "", children }: Props): React.ReactElement {
  const { ref, pos } = useMenuPosition(x, y);
  return (
    <div
      ref={ref}
      style={{ top: pos.top, left: pos.left, maxHeight: "calc(100vh - 16px)" }}
      className={`fixed z-50 py-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-y-auto ${className}`}
    >
      {children}
    </div>
  );
}
