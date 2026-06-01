// Gestion clavier partagée des tuiles/lignes : Entrée ouvre, flèches déplacent la sélection.
export function onTileKey(
  e: React.KeyboardEvent,
  onOpen: () => void,
  onArrow: (delta: number, axis: "x" | "y") => void,
): void {
  switch (e.key) {
    case "Enter": e.preventDefault(); onOpen(); break;
    case "ArrowLeft": e.preventDefault(); onArrow(-1, "x"); break;
    case "ArrowRight": e.preventDefault(); onArrow(1, "x"); break;
    case "ArrowUp": e.preventDefault(); onArrow(-1, "y"); break;
    case "ArrowDown": e.preventDefault(); onArrow(1, "y"); break;
  }
}
