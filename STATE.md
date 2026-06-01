# STATE — Vela

## Objectif
File manager Linux (Tauri v2 + React/TypeScript) avec deux modes : navigation classique et édition intégrée. Alternative souveraine à Nemo.

## État — v1.5 (fonctionnel, installé)

**Backend Rust — modules**
- `fs_ops.rs` : `list_dir`, `read_file`, `write_file` (crée si absent), `rename_entry`, `delete_entry`, `create_dir`, `move_entry`, `open_native` (xdg-open), `read_file_chunk`, `read_file_base64`, `search_dir` (async spawn_blocking), `get_entry_props` (taille récursive, permissions Unix, item/file/dir count)
- `ops.rs` : `trash_entries` (corbeille XDG via crate `trash`), `delete_entries` (définitif), `copy_entries`/`move_entries` (async, copie par chunks 1 Mo, suffixe « copie N » anti-écrasement, émission `transfer-progress` **en octets** si ≥8 fichiers OU ≥100 Mo, throttle 80 ms), `create_archive` (ZIP Deflated / TAR.GZ via `walkdir`), `search_content` (grep récursif async, skip binaires + dirs lourds, 200 matchs max), `trash_dir`/`trash_count`/`empty_trash` (gestion corbeille XDG : files/ + info/)
- `watcher.rs` : `DirWatcher` (state Tauri), `watch_dir` (notify non-récursif, émet event `fs-changed`)
- `thumbs.rs` : `thumbnail` (crate `image`, miniature PNG base64, cache `~/.cache/vela/thumbs`, clé hash path+mtime+max, resize Lanczos3, skip > 20 Mo, async spawn_blocking)
- `places.rs` : `home_dir`, `list_places` (XDG + /proc/mounts, kind: home/dir/mount)
- `favorites.rs` : `load_favorites`, `save_favorites` → `~/.config/vela/favorites.json`
- `archive.rs` : `list_archive`, `ExtractionManager` (state Tauri managé), `start_extraction`, `extraction_pause`, `extraction_resume`, `extraction_cancel`, `extraction_provide_password` — ZIP natif (par entrée, pause AtomicBool, détection chiffrement `by_index_raw().encrypted()`), TAR/GZ/BZ2/XZ natifs, RAR/7Z via `7z` (SIGSTOP/SIGCONT, parsing stdout `-bsp1`)
- `apps.rs` : `get_apps_for_file`, `search_path_bins`, `set_default_app`, `set_custom_command`

**apps.rs — détail**
- MIME détecté par extension via `mime_guess` (cohérence cross-fichiers) + fallback `xdg-mime query filetype`
- `scan_apps` : tous les `.desktop` de `/usr/share/applications`, `/usr/local/share/applications`, `~/.local/share/applications`, flatpak, snap — `supports_mime: bool`, trié compatible en premier
- `search_path_bins(query)` : scan PATH + `/opt/**/bin` + `~/.local/bin`, filtre par query, max 100 résultats, async
- `set_custom_command(name, exec, mime)` : crée `vela-custom-{slug}.desktop` dans `~/.local/share/applications/`, appelle `xdg-mime default`
- Binaires PATH → `vela-auto-{name}.desktop` créé à la volée si sélectionné

**Frontend**
- Mode Fichiers : sidebar, grille, breadcrumb, hidden, refresh, CRUD (fichier + dossier), search live
- Mode Édition : split liste/éditeur — CodeMirror, Ctrl+S/F, Markdown, tableau, image (base64), archive, inconnus éditables, gros fichiers chunks
- **Sélection multiple** : `selection: Set<string>` — clic simple, Ctrl+clic (toggle), Shift+clic (range depuis anchor), Ctrl+A, Échap (clear). `selected` = élément actif (preview éditeur)
- **Presse-papier interne** : copier/couper (Ctrl+C/X), coller dans cwd (Ctrl+V) — `copy_entries`/`move_entries`, cut vide le presse-papier après paste
- **Corbeille** : Suppr → corbeille XDG (confirmation), Shift+Suppr → suppression définitive (confirmation renforcée)
- **Compression** : `CompressModal` — nom + format ZIP/TAR.GZ depuis la sélection
- **Renommage par lot** : `BatchRenameModal` — rechercher/remplacer + jeton `{n}`, aperçu live
- **Quick Look** : Espace → overlay `QuickLook` réutilisant l'éditeur, sans entrer en mode Édition
- **Raccourcis clavier** : `useKeyboard` — désactivé dans les champs/CodeMirror (`.cm-editor`)
- **Recherche** : toggle Nom (récursif) / Contenu (grep) dans la SearchInput
- **Watch live** : `useFileManager` écoute `fs-changed` → refresh debounce 250ms ; `watch_dir(cwd)` à chaque navigation
- **Corbeille** : section Système en bas de `Sidebar` — badge compteur, clic = ouvrir `~/.local/share/Trash/files`, clic droit = menu « Vider » (ancré top, ouvre vers le haut). Bouton « Vider (N) » aussi dans la topbar quand cwd = corbeille (confirmation dans les deux cas)
- **Persistance session** : `vela-session` localStorage (cwd, mode, hidden) — restaurée au démarrage
- Tri : `useSort` — by name/size/modified/extension, ASC/DESC, dossiers en tête, filtre Tout/Dossiers/Fichiers — persisté localStorage (`vela-sort`)
- `SortBar` : barre compacte 32px toujours visible sous topbar
- Drag & drop : FileTile, FileList, crumbs Topbar, Sidebar — drag d'un élément sélectionné déplace toute la sélection
- Clic droit fichier/dossier : `ContextMenu` mono/multi — ouvrir, Extraire ici/vers… (archive), copier, couper, compresser, renommer (mono) / par lot (multi), corbeille, suppression définitive, copier chemin, propriétés
- Clic droit zone vide : `BgContextMenu` — nouveau fichier/dossier, **coller** (si presse-papier), actualiser, toggle hidden, épingler dossier, propriétés dossier
- Propriétés : Informations / Contenu dossier / Taille / Ouvrir avec — scan PATH + commande custom, création `.desktop` auto
- Extraction asynchrone : `ExtractionPanel` bas-droite fixe — jobs empilés scrollables, progression temps réel (Tauri events), pause/reprise/annulation, mot de passe inline, "Aller au dossier", auto-dismiss 6s après fin
- **Progression transferts** : `useTransfers` écoute `transfer-progress`, `ExtractionPanel` empile les `TransferRow` (copie/déplacement, %, n/total fichiers) avec les extractions
- **Aperçu PDF** : `PdfViewer` (pdf.js, worker local `?url`) — canvas page par page, zoom 50-300%, lazy IntersectionObserver au-delà de 20 pages. Branché dans `Editor` (`previewKind` "pdf", non éditable) → dispo en Quick Look
- **Thumbnails images** : `useThumbnail` (IntersectionObserver lazy, file de concurrence globale 4) + `FileTile` affiche la miniature réelle (fallback `FileIcon` pendant chargement/erreur)

**Commandes Rust** : 38 enregistrées dans `lib.rs` (manage `ExtractionManager` + `DirWatcher`)

**Infra**
- Build : `bun tauri build` (targets: deb, rpm — AppImage exclu, linuxdeploy absent)
- Binaire : `~/.local/bin/vela-bin`, wrapper : `~/.local/bin/vela` (WEBKIT_DISABLE_DMABUF_RENDERER=1)
- Raccourci `Super+E` → `/home/trinity/.local/bin/vela`
- Port dev : 1430 (vite.config.ts + tauri.conf.json)
- GitHub : https://github.com/trinityUwU/vela (public)

## Décisions techniques
- `open_native` via xdg-open (commande Rust maison) — contourne bug ACL `opener:allow-open-path` Tauri v2
- Archives : natif Rust (zip/tar/flate2/bzip2/xz2) + fallback `7z` pour RAR/7Z
- Compound extensions : `tar.gz` → extension `tar.gz` via `compound_extension()` dans `to_entry`
- MIME par extension (`mime_guess`) : cohérence garantie pour tous les fichiers du même type — fix du bug où deux `.md` pouvaient avoir des MIME différents selon leur contenu
- Apps scan : toutes les apps + scan PATH, `supports_mime: bool`, deux groupes Compatible/Autres + section Programmes (PATH)
- `set_custom_command` → crée un `.desktop` minimal dans `~/.local/share/applications/` avant d'appeler `xdg-mime default`
- Tri/filtre côté frontend (JS sort) — zéro round-trip Rust, réactif instantanément
- `bun tauri build` obligatoire (pas `cargo build --release` direct)

## Limitation connue
WebKitGTK comme couche de rendu (vs GTK natif chez Nemo/Thunar en C). Plus de RAM, démarrage plus lent. Trade-off assumé pour la richesse de l'UI.

## Prochain chantier — v1.5
**Specs complètes détaillées dans `TODO.md` (section « À FAIRE — specs détaillées »).**
Ordre : (1) progression copie/déplacement ✅ → (2) aperçu PDF → (3) thumbnails images.
- (1) ✅ `ops.rs` `copy_entries`/`move_entries` async (spawn_blocking, await fin) + event `transfer-progress` (seuil 8 fichiers anti-flicker, throttle 80ms) + `useTransfers` + `ExtractionPanel` généralisé (TransferRow)
- (2) ✅ `pdfjs-dist` (worker local `?url`) + `PdfViewer.tsx` (canvas/page, zoom, lazy >20 pages) branché dans `Editor` → Quick Look gratuit. `previewKind` "pdf", `isEditable=false`
- (3) ✅ `thumbs.rs` (crate `image`, cache PNG `~/.cache/vela/thumbs`, hash std path+mtime+max, Lanczos3, skip >20 Mo) + `useThumbnail` (IntersectionObserver, file concurrence globale 4) + `FileTile`

## Backlog (non priorisé)
- Onglets multi-fichiers en mode Édition · Diff 2 fichiers (CodeMirror merge) · Terminal intégré · Tags/couleurs · Annuler (Ctrl+Z)
