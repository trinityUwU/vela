// Notification d'installation d'un outil système manquant : ouvre un terminal et y injecte la commande.
import { useCallback, useState } from "react";
import { termInput } from "../services/term";

export interface InstallReq {
  label: string;
  cmd: string;
}

export function useInstallPrompt(
  openTerminal: (cwd: string) => Promise<string | null>,
  cwd: string,
  showTerminal: () => void,
) {
  const [prompt, setPrompt] = useState<InstallReq | null>(null);
  const run = useCallback(async () => {
    if (!prompt) return;
    const id = await openTerminal(cwd);
    showTerminal();
    if (id) termInput(id, prompt.cmd + "\n").catch(() => {});
    setPrompt(null);
  }, [prompt, openTerminal, cwd, showTerminal]);
  return { prompt, request: setPrompt, run, dismiss: () => setPrompt(null) };
}
