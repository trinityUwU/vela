# BACKLOG — Vela

Idées identifiées au tour des features (2026-06-02). Ordonnées par impact.
Statut : `à faire` · `en cours` · `livré`. Quand livré → migrer la ligne dans `TODO.md`.

## P1 — manques criants (réflexes utilisateur) — ✅ LIVRÉ v1.9

| # | Feature | Détail | Statut |
|---|---------|--------|--------|
| 1 | Vue liste détaillée triable | Colonnes Nom/Taille/Date/Type, tri au clic d'en-tête (`useSort`). Bascule grille ↔ liste topbar, persistée `vela-view`. | livré |
| 2 | Historique navigation | Back/Forward (Alt+←/→) + boutons topbar. Pile dans `useFileManager`. | livré |
| 3 | Navigation clavier | Flèches déplacent la sélection, Entrée ouvre. | livré |
| 4 | Ouvrir terminal ici | Clic droit dossier → onglet PTY dans ce dossier. | livré |

## P2 — confort

| # | Feature | Détail | Statut |
|---|---------|--------|--------|
| 5 | Thèmes / personnalisation | Couleur d'accent + densité (compact/confort) configurables, persistées. | à faire |
| 6 | Recherches récentes | Historique des dernières recherches Nom/Contenu, rappel rapide. | à faire |
| 7 | Taille de dossier à la demande | Calcul récursif (du-like) déclenché manuellement sur un dossier. | à faire |
| 8 | Analyse disque | Mode doublons + fichiers volumineux (scan + tri par taille). | à faire |

## P3 — avancé / souveraineté

| # | Feature | Détail | Statut |
|---|---------|--------|--------|
| 9 | Aperçu vidéo / audio | Thumbnails vidéo + lecteur inline (lecture seule). | à faire |
| 10 | Comparaison de dossiers | Diff de deux arbres (présent/absent/modifié), pas seulement 2 fichiers. | à faire |
