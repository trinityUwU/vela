// Panneau Réglages : référence de toutes les features de Vela et comment les utiliser.
import { useEffect } from "react";
import { Settings } from "./icons";

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
      { keys: ["⌫ haut"], label: "Remonter d'un dossier (bouton topbar)" },
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
      { label: "Copier le chemin · Propriétés · Ouvrir avec (app par défaut ou commande)" },
    ],
  },
  {
    title: "Aperçu",
    rows: [
      { keys: ["Espace"], label: "Quick Look — aperçu rapide sans entrer en édition" },
      { label: "Markdown & HTML — bascule code ↔ rendu" },
      { label: "PDF (zoom, pages), images (miniatures), CSV (tableau), archives (contenu)" },
    ],
  },
  {
    title: "Édition",
    rows: [
      { label: "Onglets multi-fichiers — ouvre plusieurs fichiers, bascule par onglet" },
      { label: "Fermer un onglet : × ou clic-milieu ; les éditions non sauvegardées sont conservées" },
      { keys: ["Ctrl", "S"], label: "Sauvegarder" },
      { keys: ["Ctrl", "F"], label: "Rechercher dans le fichier" },
    ],
  },
  {
    title: "Recherche",
    rows: [
      { keys: ["Ctrl", "F"], label: "Ouvrir la recherche (hors éditeur)" },
      { label: "Bascule Nom (récursif) / Contenu (grep dans les fichiers)" },
    ],
  },
  {
    title: "Terminal intégré",
    rows: [
      { keys: ["Ctrl", "`"], label: "Afficher / masquer le terminal" },
      { label: "Onglets multi-sessions ; ＋ nouveau, ▾ choisir le shell (bash, zsh…)" },
      { label: "« Suivre » synchronise le terminal sur le dossier courant" },
      { label: "Bord supérieur déplaçable pour redimensionner le panneau" },
    ],
  },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
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

        <div className="overflow-y-auto px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
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
