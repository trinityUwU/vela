// Panneau Réglages : apparence (accent + densité) + référence des features et raccourcis.
import { useEffect } from "react";
import { Settings } from "./icons";
import { ACCENT_PRESETS, type Density } from "../hooks/useAppearance";

interface AppearanceProps {
  accent: string;
  density: Density;
  onAccent: (hex: string) => void;
  onDensity: (d: Density) => void;
}

interface Row {
  keys?: string[];
  label: string;
}
interface Section {
  title: string;
  rows: Row[];
}

const SECTIONS: Section[] = [
  {
    title: "Navigation",
    rows: [
      { keys: ["Entrée", "double-clic"], label: "Ouvrir un dossier ou un fichier" },
      { keys: ["←", "→", "↑", "↓"], label: "Déplacer la sélection au clavier ; Entrée pour ouvrir" },
      { keys: ["Alt", "←"], label: "Précédent (historique de navigation)" },
      { keys: ["Alt", "→"], label: "Suivant (historique de navigation)" },
      { keys: ["⌫ haut"], label: "Remonter d'un dossier (bouton topbar)" },
      { label: "Bascule vue grille / liste détaillée (bouton topbar, mode Fichiers)" },
      { label: "Vue liste : colonnes Nom/Taille/Date/Type, tri au clic d'en-tête" },
      { label: "Fil d'Ariane cliquable pour remonter à n'importe quel niveau" },
      { keys: ["F5"], label: "Actualiser le dossier courant" },
      { keys: ["Ctrl", "H"], label: "Afficher / masquer les fichiers cachés (bouton topbar)" },
      { label: "Épingler un dossier en favori avec ＋, l'organiser en groupes" },
      { label: "Glisser un élément sur un favori ou un emplacement pour l'y déplacer" },
    ],
  },
  {
    title: "Modes",
    rows: [
      { label: "Fichiers — grille classique de navigation" },
      { label: "Édition — liste + éditeur de code intégré (bascule dans la topbar)" },
    ],
  },
  {
    title: "Sélection",
    rows: [
      { label: "Clic — sélectionner un élément" },
      { keys: ["Ctrl", "clic"], label: "Ajouter / retirer de la sélection" },
      { keys: ["Maj", "clic"], label: "Sélectionner une plage" },
      { keys: ["Ctrl", "A"], label: "Tout sélectionner" },
      { keys: ["Échap"], label: "Vider la sélection" },
    ],
  },
  {
    title: "Copier · déplacer · annuler",
    rows: [
      { keys: ["Ctrl", "C"], label: "Copier" },
      { keys: ["Ctrl", "X"], label: "Couper" },
      { keys: ["Ctrl", "V"], label: "Coller dans le dossier courant" },
      { label: "Glisser-déposer pour déplacer (gros transferts : pause / annulation)" },
      { keys: ["Ctrl", "Z"], label: "Annuler la dernière action (renommage, déplacement, copie, corbeille)" },
    ],
  },
  {
    title: "Fichiers",
    rows: [
      { keys: ["F2"], label: "Renommer" },
      { label: "Renommage par lot — chercher/remplacer + jeton {n} (menu contextuel)" },
      { keys: ["Suppr"], label: "Mettre à la corbeille" },
      { keys: ["Maj", "Suppr"], label: "Supprimer définitivement" },
      { label: "Compresser en ZIP ou TAR.GZ ; extraire les archives (menu contextuel)" },
      { label: "Étiquettes couleur — clic droit → pastille (applicable à une sélection)" },
      { label: "Dossier — clic droit « Calculer la taille » (affichée dans la colonne Taille)" },
      { label: "Dossier — clic droit « Analyser l'espace » : plus gros fichiers + doublons" },
      { label: "Copier le chemin · Propriétés · Ouvrir avec (app par défaut ou commande)" },
    ],
  },
  {
    title: "Aperçu",
    rows: [
      { keys: ["Espace"], label: "Quick Look — aperçu rapide sans entrer en édition" },
      { label: "Markdown & HTML — bascule code ↔ rendu" },
      { label: "PDF (zoom, pages), images (miniatures), CSV (tableau), archives (contenu)" },
      { label: "Vidéo — lecteur natif (décodage GPU) : play/pause, seek, volume, plein écran" },
      { label: "Audio — lecteur inline ; plein écran vidéo : toolbar auto-masquée, Échap pour sortir" },
    ],
  },
  {
    title: "Édition",
    rows: [
      { label: "Onglets multi-fichiers — ouvre plusieurs fichiers, bascule par onglet" },
      { label: "Fermer un onglet : × ou clic-milieu ; les éditions non sauvegardées sont conservées" },
      { keys: ["Ctrl", "S"], label: "Sauvegarder" },
      { keys: ["Ctrl", "F"], label: "Rechercher dans le fichier" },
      { label: "Sélectionner 2 fichiers → clic droit « Comparer » (diff côte à côte)" },
      { label: "Sélectionner 2 dossiers → clic droit « Comparer » (arbres : ajoutés/supprimés/modifiés)" },
    ],
  },
  {
    title: "Recherche",
    rows: [
      { keys: ["Ctrl", "F"], label: "Ouvrir la recherche (hors éditeur)" },
      { label: "Bascule Nom (récursif) / Contenu (grep dans les fichiers)" },
      { label: "Champ vide → liste des recherches récentes (cliquer pour rejouer)" },
    ],
  },
  {
    title: "Terminal intégré",
    rows: [
      { keys: ["Ctrl", "`"], label: "Afficher / masquer le terminal" },
      { label: "Clic droit sur un dossier → « Ouvrir un terminal ici »" },
      { label: "Onglets multi-sessions ; ＋ nouveau, ▾ choisir le shell (bash, zsh…)" },
      { label: "Clic droit sur un onglet → renommer + pastille couleur (double-clic = renommer)" },
      { label: "« Suivre » synchronise le terminal sur le dossier courant" },
      { label: "Bord supérieur déplaçable pour redimensionner le panneau" },
    ],
  },
];

const DENSITIES: { key: Density; label: string }[] = [
  { key: "compact", label: "Compact" },
  { key: "cozy", label: "Normal" },
  { key: "comfortable", label: "Confort" },
];

interface NlProps {
  enabled: boolean;
  endpoint: string;
  onToggle: (v: boolean) => void;
  onEndpoint: (v: string) => void;
}

export function SettingsPanel({ onClose, appearance, onResetBrowser, nl }: {
  onClose: () => void;
  appearance: AppearanceProps;
  onResetBrowser: () => void;
  nl: NlProps;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(720px,92vw)] max-h-[85vh] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
      >
        <div className="flex items-center gap-2.5 px-5 h-14 border-b border-[var(--color-border)] shrink-0">
          <span className="text-[var(--color-accent)]"><Settings width={20} height={20} /></span>
          <h2 className="text-base font-medium text-[var(--color-text)]">Réglages & aide</h2>
          <div className="flex-1" />
          <button onClick={onClose} className="px-2 py-1 text-sm rounded text-[var(--color-text-dim)] hover:text-[var(--color-text)]">
            Fermer
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <section className="mb-5 pb-5 border-b border-[var(--color-border)]">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-accent)] font-semibold mb-2.5">Apparence</h3>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-dim)] mr-1">Accent</span>
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => appearance.onAccent(c.hex)}
                    style={{ backgroundColor: c.hex }}
                    className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                      appearance.accent === c.hex ? "ring-2 ring-[var(--color-text)] ring-offset-2 ring-offset-[var(--color-surface)]" : ""
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-dim)] mr-1">Densité</span>
                <div className="flex rounded-md bg-[var(--color-bg)] p-0.5 border border-[var(--color-border)]">
                  {DENSITIES.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => appearance.onDensity(d.key)}
                      className={`px-2.5 py-1 text-xs rounded transition-colors ${
                        appearance.density === d.key
                          ? "bg-[var(--color-accent)] text-[var(--color-bg)] font-medium"
                          : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="mb-5 pb-5 border-b border-[var(--color-border)]">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-accent)] font-semibold mb-2.5">Navigateur</h3>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[var(--color-text-dim)]">
                Cookies et sessions sont conservés entre les lancements. Réinitialiser efface tout (déconnexion de tous les sites).
              </span>
              <button
                onClick={onResetBrowser}
                className="shrink-0 px-3 py-1.5 text-xs rounded-md text-[var(--color-danger)] border border-[var(--color-danger)]/40 hover:bg-[var(--color-danger)]/10 transition-colors"
              >
                Réinitialiser le navigateur
              </button>
            </div>
          </section>

          <section className="mb-5 pb-5 border-b border-[var(--color-border)]">
            <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-accent)] font-semibold mb-2.5">
              Palette intelligente (LLM local)
            </h3>
            <div className="flex flex-col gap-2.5">
              <label className="flex items-center gap-2 text-xs text-[var(--color-text)]/85">
                <input type="checkbox" checked={nl.enabled} onChange={(e) => nl.onToggle(e.target.checked)} />
                Interpréter le langage naturel dans la palette (Ctrl+K) via EchoHub — 100% local, désactivé par défaut.
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-text-dim)]">Endpoint</span>
                <input
                  type="text"
                  value={nl.endpoint}
                  onChange={(e) => nl.onEndpoint(e.target.value)}
                  disabled={!nl.enabled}
                  className="flex-1 px-2 py-1 text-xs rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[var(--color-text)] outline-none disabled:opacity-40"
                />
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
          {SECTIONS.map((s) => (
            <section key={s.title}>
              <h3 className="text-[11px] uppercase tracking-wider text-[var(--color-accent)] font-semibold mb-2">{s.title}</h3>
              <ul className="space-y-1.5">
                {s.rows.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-dim)] leading-relaxed">
                    {r.keys && (
                      <span className="flex gap-1 shrink-0 pt-px">
                        {r.keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
                      </span>
                    )}
                    <span className="text-[var(--color-text)]/85">{r.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-[var(--color-border)] text-[11px] text-[var(--color-text-dim)] shrink-0">
          Vela — gestionnaire de fichiers souverain · Tauri + React · thème sombre
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 rounded bg-[var(--color-bg)] border border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text)] whitespace-nowrap">
      {children}
    </kbd>
  );
}
