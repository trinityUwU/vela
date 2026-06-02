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

## P2 — confort — ✅ LIVRÉ v1.11

| # | Feature | Détail | Statut |
|---|---------|--------|--------|
| 5 | Thèmes / personnalisation | Accent (6 presets) + densité (compact/normal/confort via font-size rem) dans Réglages, persisté `vela-appearance`. | livré |
| 6 | Recherches récentes | 8 dernières (q+mode) persistées `vela-search-recents`, champ vide → liste cliquable. | livré |
| 7 | Taille de dossier à la demande | Clic droit dossier → « Calculer la taille » (réutilise `get_entry_props`), affichée colonne Taille (vue liste). | livré |
| 8 | Analyse disque | `analyze_disk` Rust (walkdir + dédup hash DefaultHasher) → overlay plus gros fichiers + doublons. | livré |

## P3 — avancé / souveraineté — ✅ LIVRÉ v1.12

| # | Feature | Détail | Statut |
|---|---------|--------|--------|
| 9 | Aperçu vidéo / audio | Lecteur inline `<video>`/`<audio>` via protocole asset Tauri (`convertFileSrc`). Codecs = GStreamer système. Thumbnails vidéo écartés (ffmpeg = dép lourde, contre souveraineté légère). | livré |
| 10 | Comparaison de dossiers | `compare_dirs` Rust (walkdir 2 arbres, statut only_a/only_b/modified/same par taille+mtime). Overlay `DirCompareViewer` filtrable. Clic droit 2 dossiers → Comparer. | livré |

## P4 — outils média non-destructifs — ✅ LIVRÉ v1.13

Suite média intégrée, modèle « fichier → paramètre → exporte » (aucune timeline). Clic droit sur un fichier média → entrée « Outils audio/vidéo… » ou « Éditer l'image… » → `MediaToolsModal` route vers le panneau selon `previewKind`.

| # | Domaine | Détail | Statut |
|---|---------|--------|--------|
| 11 | Audio (ffmpeg) | Découper (stream copy), fondu in/out, normaliser (loudnorm), convertir (mp3/flac/wav/ogg/m4a + bitrate), suppression voix rapide (pan center-removal, sans IA). `audio.rs`. | livré |
| 12 | Stems IA (demucs) | Séparation voix/batterie/basse/autres + mode voix/accompagnement. Détection venv optionnelle (`~/.local/share/vela/demucs-venv`), install proposée (venv + pip), progression + cancel. `stems.rs`. | livré |
| 13 | Image (crate `image`) | Recadrer, pivoter 90/180/270, retourner, redimensionner, ajustements (luminosité/contraste/saturation, aperçu CSS live), convertir (png/jpg/webp + qualité). `imaging.rs`. | livré |
| 14 | Vidéo (ffmpeg) | Découper sans réencodage, convertir/compresser (CRF, job background + progress + cancel), extraire une image, extraire l'audio. `video.rs`. | livré |

Validation : 20 tests Rust (ops réelles ffmpeg/image), `bun tauri build` OK (deb+rpm), boot binaire réel sans panic. demucs non installé sur la machine → séparation IA non testée runtime (chemin « non installé → propose install » validé).

— Backlog vidé. Prochaines idées à définir avec Chris.
