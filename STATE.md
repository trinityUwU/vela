# STATE — Vela

## Objectif
File manager Linux natif (Tauri v2 + React/TypeScript) avec deux modes : navigation classique et édition intégrée. Alternative souveraine à Nemo.

## État — v1.1 (fonctionnel, installé)

**Backend Rust — modules**
- `fs_ops.rs` : `list_dir`, `read_file`, `write_file`, `rename_entry`, `delete_entry`, `create_dir`, `move_entry`, `open_native` (xdg-open), `read_file_chunk`, `read_file_base64`, `search_dir` (async spawn_blocking), `get_entry_props` (taille récursive, permissions Unix, item/file/dir count)
- `places.rs` : `home_dir`, `list_places` (XDG + /proc/mounts, kind: home/dir/mount)
- `favorites.rs` : `load_favorites`, `save_favorites` → `~/.config/vela/favorites.json`
- `archive.rs` : `list_archive`, `extract_archive` — ZIP natif, TAR/GZ/BZ2/XZ natifs, RAR/7Z via système `7z`
- `apps.rs` : `get_apps_for_file` (xdg-mime + scan .desktop tous dossiers), `set_default_app`

**Frontend**
- Mode Fichiers : sidebar (Favoris/groupes/Emplacements/Montages), grille d'icônes, breadcrumb éditable, hidden, refresh, CRUD contextuel, search live (debounce 500ms, min 2 chars, 150 résultats)
- Mode Édition : split liste/éditeur — CodeMirror (10+ langages), Ctrl+S, Ctrl+F (search panel), aperçu Markdown, tableau CSV/XLSX/ODS (SheetJS), preview image (base64 data URL), viewer archive avec extraction, tous fichiers inconnus → éditables
- Gros fichiers : chunks 512 Ko, bannière + "Charger la suite", skip lecture pour images/archives
- Drag & drop : FileTile, FileList, crumbs Topbar, Sidebar — `application/vela` dataTransfer, garde anti-boucle Rust
- Propriétés (clic droit) : sections Informations / Contenu (dossiers) / Taille / Ouvrir avec — app par défaut modifiable, liste compatible + toutes apps, xdg-mime default
- Fenêtre immersive (`decorations: false`), topbar draggable

**Infra**
- Build : `bun tauri build` (targets: deb, rpm — AppImage exclu, linuxdeploy absent)
- Binaire : `~/.local/bin/vela-bin`, wrapper : `~/.local/bin/vela` (WEBKIT_DISABLE_DMABUF_RENDERER=1)
- Raccourci `Super+E` → `/home/trinity/.local/bin/vela`
- Port dev : 1430 (vite.config.ts + tauri.conf.json)
- GitHub : https://github.com/trinityUwU/vela (public)

## Décisions techniques
- `open_native` via xdg-open (commande Rust maison) — contourne bug ACL `opener:allow-open-path` Tauri v2
- `opener:allow-open-path` ajouté aux capabilities mais insuffisant seul → xdg-open bypasse le problème
- Archives : natif Rust (zip/tar/flate2/bzip2/xz2) + fallback `7z` pour RAR/7Z
- Compound extensions : `tar.gz` → extension `tar.gz` (pas `gz`) via `compound_extension()` dans `to_entry`
- Apps scan : toutes les apps installées, `supports_mime: bool`, séparation "Compatible / Autres" côté UI
- `bun tauri build` obligatoire (pas `cargo build --release` direct) — seul la CLI Tauri embarque correctement les assets frontend

## Backlog
- Onglets multi-fichiers en mode Édition
- Watch live dossier (crate `notify`)
- Copier / couper / coller
- Raccourcis clavier navigation (flèches, F2, Suppr)
- Persistance (dernier dossier, mode, fichiers cachés)
- Tri configurable (nom/taille/date)
- Thumbnails images en mode Fichiers
- Aperçu PDF
