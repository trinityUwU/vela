// Notification bas-droite proposant d'installer un outil système manquant (ex. tesseract).
// « Installer » ouvre un terminal et y injecte la commande (l'utilisateur voit la sortie + sudo).
interface Props {
  prompt: { label: string; cmd: string } | null;
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallPrompt({ prompt, onInstall, onDismiss }: Props) {
  if (!prompt) return null;
  return (
    <div className="fixed bottom-3 right-3 z-50 w-80 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl p-3 flex flex-col gap-2">
      <p className="text-xs text-[var(--color-text)]">
        {prompt.label} n'est pas installé. L'installer maintenant ?
      </p>
      <code className="text-[10px] text-[var(--color-text-dim)] font-mono break-all">{prompt.cmd}</code>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onDismiss}
          className="px-2 py-1 text-[11px] rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        >
          Plus tard
        </button>
        <button
          onClick={onInstall}
          className="px-3 py-1 text-[11px] rounded bg-[var(--color-accent)] text-[var(--color-bg)]"
        >
          Installer
        </button>
      </div>
    </div>
  );
}
