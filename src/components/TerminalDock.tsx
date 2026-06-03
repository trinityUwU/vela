// Dock terminal bas redimensionnable (hors système de zones).
import type { ComponentProps } from "react";
import { ResizeHandle } from "./ResizeHandle";
import { TerminalPanel } from "./TerminalPanel";

interface Props {
  visible: boolean;
  height: number;
  onResize: (dy: number) => void;
  terminal: ComponentProps<typeof TerminalPanel>;
}

export function TerminalDock({ visible, height, onResize, terminal }: Props): React.ReactElement {
  return (
    <div className={`shrink-0 flex flex-col ${visible ? "" : "hidden"}`} style={{ height: visible ? height : 0 }}>
      <ResizeHandle onResize={onResize} />
      <div className="flex-1 min-h-0"><TerminalPanel {...terminal} /></div>
    </div>
  );
}
