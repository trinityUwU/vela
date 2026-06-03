// Réglages de la palette intelligente (LLM local EchoHub) — opt-in, désactivé par défaut.
import { useCallback, useState } from "react";

export interface NlSettings {
  enabled: boolean;
  endpoint: string;
}

const KEY = "vela-nl";
const DEFAULT: NlSettings = { enabled: false, endpoint: "http://127.0.0.1:37821" };

function load(): NlSettings {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return DEFAULT;
  }
}

export function useNlSettings() {
  const [settings, setSettings] = useState<NlSettings>(load);
  const update = useCallback((patch: Partial<NlSettings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);
  return { settings, update };
}
