# TODO — Vela

## Livré (session courante)
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
- [x] Apps "Ouvrir avec" : scan toutes apps installées, deux groupes Compatible/Autres

## Backlog
- [ ] Onglets multi-fichiers en mode Édition
- [ ] Watch live dossier (crate notify → refresh auto)
- [ ] Copier / couper / coller (Ctrl+C, Ctrl+X, Ctrl+V)
- [ ] Raccourcis clavier navigation (flèches, Entrée, F2 renommer, Suppr)
- [ ] Persistance préférences (dernier dossier, mode, fichiers cachés)
- [ ] Tri configurable (nom/taille/date, ASC/DESC)
- [ ] Thumbnails images en mode Fichiers
- [ ] Aperçu PDF
- [ ] Sélection multiple (Shift+clic, Ctrl+clic)
- [ ] Progression extraction archives volumineuses
