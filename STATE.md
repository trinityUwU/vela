# STATE — Vela

## Objectif
File manager Linux (Tauri v2 + React/TypeScript) avec deux modes : navigation classique et édition intégrée. Alternative souveraine à Nemo.

## État — v1.2 (fonctionnel, installé)

**Backend Rust — modules**
- `fs_ops.rs` : `list_dir`, `read_file`, `write_file` (crée si absent), `rename_entry`, `delete_entry`, `create_dir`, `move_entry`, `open_native` (xdg-open), `read_file_chunk`, `read_file_base64`, `search_dir` (async spawn_blocking), `get_entry_props` (taille récursive, permissions Unix, item/file/dir count)
- `places.rs` : `home_dir`, `list_places` (XDG + /proc/mounts, kind: home/dir/mount)
- `favorites.rs` : `load_favorites`, `save_favorites` → `~/.config/vela/favorites.json`
- `archive.rs` : `list_archive`, `extract_archive` — ZIP natif, TAR/GZ/BZ2/XZ natifs, RAR/7Z via système `7z`
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
- Tri : `useSort` — by name/size/modified/extension, ASC/DESC, dossiers en tête, filtre Tout/Dossiers/Fichiers — persisté localStorage (`vela-sort`)
- `SortBar` : barre compacte 32px toujours visible sous topbar
- Drag & drop : FileTile, FileList, crumbs Topbar, Sidebar
- Clic droit fichier/dossier : `ContextMenu` — ouvrir, copier chemin absolu, copier chemin relatif (depuis cwd), renommer, supprimer, propriétés
- Clic droit zone vide : `BgContextMenu` — nouveau fichier, nouveau dossier, actualiser, toggle hidden, épingler dossier, propriétés dossier
- Propriétés : Informations / Contenu dossier / Taille / Ouvrir avec — scan PATH + commande custom, création `.desktop` auto

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

## Backlog
- Onglets multi-fichiers en mode Édition
- Watch live dossier (crate `notify`)
- Copier / couper / coller (Ctrl+C, Ctrl+X, Ctrl+V)
- Raccourcis clavier navigation (flèches, Entrée, F2 renommer, Suppr)
- Persistance (dernier dossier, mode, fichiers cachés)
- Thumbnails images en mode Fichiers
- Aperçu PDF
- Sélection multiple (Shift+clic, Ctrl+clic)
- Progression extraction archives volumineuses
