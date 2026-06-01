# STATE — Vela

## Objectif
File manager Linux natif (Tauri) avec deux modes : navigation classique et édition intégrée. Alternative souveraine au preview pane jamais mergé dans Nemo.

## État — MVP v1 (livré, fonctionnel)

**Backend Rust**
- `list_dir` (tri dossiers/fichiers, hidden), `read_file`, `write_file`, `rename_entry`, `delete_entry`, `create_dir`
- `read_file_chunk` : lecture par tranche (offset + taille), frontière UTF-8 propre
- `home_dir`, `list_places` (XDG + `/proc/mounts`)

**Front**
- Mode Fichiers : sidebar, grille d'icônes, breadcrumb, hidden, refresh, CRUD contextuel, ouverture externe
- Mode Édition : split liste/éditeur, clic simple → ouverture, CodeMirror par langage, `Ctrl+S`, aperçu Markdown
- Icônes devicon par format (20+ langages) + génériques sobres (image, archive, pdf, doc)
- Gros fichiers : chunks 512 Ko, lecture seule > 1 Mo, bandeau info + bouton "Charger la suite"
- Fenêtre immersive (`decorations: false`), topbar draggable

**Infra**
- Build release : `~/.local/bin/vela` (wrapper fix DMABUF)
- Raccourci `Super+E` : `/home/trinity/.local/bin/vela`
- Port dev : 1430 (évite conflits sur 1420)
- GitHub : https://github.com/trinityUwU/vela (public)

## Décisions techniques
- Ops Rust custom (pas plugin-fs) → accès complet aux métadonnées
- Modals maison (webkit ne garantit pas `window.prompt`)
- Seuil 1 Mo lecture seule → pas de corruption sur gros fichiers
- `WEBKIT_DISABLE_DMABUF_RENDERER=1` intégré dans le wrapper binaire

## Backlog
- Aperçu images inline (asset protocol Tauri)
- Onglets multi-fichiers
- Watch live dossier (crate `notify`)
- Copier/coller, drag & drop
- Raccourcis clavier navigation (flèches, F2, Suppr)
- Persistance (dernier dossier, mode, préférences)
- Tri configurable
- Thumbnails images, aperçu PDF
