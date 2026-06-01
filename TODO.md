# TODO — Vela

## Livré

- [x] Preview image inline (base64 data URL, skip useFileContent)
- [x] Viewer archive ZIP/TAR/GZ/BZ2/XZ/RAR/7Z + extraction (ici ou chemin custom)
- [x] Drag & drop déplacement (grille, liste, crumbs, sidebar)
- [x] Propriétés clic droit (métadonnées, contenu dossier, app par défaut modifiable)
- [x] Recherche live dans le dossier (debounce 500ms, Rust async, 150 résultats)
- [x] Search in-file CodeMirror (Ctrl+F)
- [x] Sidebar Favoris/groupes + Emplacements + Montages séparés
- [x] Fichiers sans extension reconnus → éditables (plus openNative)
- [x] Fix ACL opener → open_native via xdg-open
- [x] Fix build AppImage (targets deb+rpm uniquement)
- [x] Apps "Ouvrir avec" : scan toutes apps + PATH complet + commande personnalisée
- [x] Clic droit zone vide : nouveau fichier/dossier, actualiser, toggle hidden, épingler, propriétés dossier
- [x] Copier chemin absolu / chemin relatif depuis cwd (clic droit fichier)
- [x] Nouveau fichier (InputModal → write_file vide + refresh)
- [x] Tri configurable (nom/taille/date/type, ASC/DESC, dossiers en tête) — persisté localStorage
- [x] Filtre Tout / Dossiers / Fichiers
- [x] Fix MIME cohérence cross-fichiers (mime_guess par extension, plus xdg-mime filetype)
- [x] README : limitation WebKit vs GTK natif documentée
- [x] Extraction asynchrone non-bloquante (background threads, Tauri events)
- [x] Panel extraction bas-droite : progression, pause/reprise/annulation, mot de passe, aller au dossier
- [x] Support archives protégées par mot de passe (ZIP by_index_decrypt, 7z/RAR -p flag)
- [x] Clic droit archive → Extraire ici / Extraire vers… (sans passer par le visualiseur)
- [x] Fix build : `bun tauri build` obligatoire (cargo build seul ne produit pas de binaire autonome)

## Backlog

- [ ] Onglets multi-fichiers en mode Édition
- [ ] Watch live dossier (crate `notify` → refresh auto)
- [ ] Copier / couper / coller (Ctrl+C, Ctrl+X, Ctrl+V)
- [ ] Raccourcis clavier navigation (flèches, Entrée, F2 renommer, Suppr)
- [ ] Persistance (dernier dossier ouvert, mode, état fichiers cachés)
- [ ] Thumbnails images en mode Fichiers
- [ ] Aperçu PDF
- [ ] Sélection multiple (Shift+clic, Ctrl+clic)
