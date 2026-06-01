# Vela

File manager natif Linux avec deux modes : navigation classique et édition intégrée. En mode Édition, un clic sur un fichier l'ouvre directement dans la fenêtre — CodeMirror avec coloration syntaxique, sauvegarde `Ctrl+S`, aperçu Markdown live. Aucune dépendance réseau.

## Pourquoi

Nemo n'a jamais intégré de preview pane. Vela le fait nativement, avec un vrai éditeur, sans fork à maintenir.

## Fonctionnalités

**Mode Fichiers**
- Navigation grille avec icônes par format (logos devicon + SVG génériques)
- Sidebar : Favoris (pins + groupes collapsibles), Emplacements XDG, Montages
- Breadcrumb éditable (clic → saisie chemin directe)
- Recherche live dans le dossier (debounce 500ms, 150 résultats)
- CRUD : renommer, supprimer, nouveau dossier (menu contextuel)
- **Drag & drop** : fichiers/dossiers vers dossiers, crumbs du chemin, sidebar
- **Clic droit → Propriétés** : métadonnées complètes, contenu dossier, app par défaut modifiable

**Mode Édition**
- Split liste / éditeur
- CodeMirror 6 (Python, JS/TS, Rust, HTML, CSS, JSON, Markdown, Go, PHP…)
- `Ctrl+S` sauvegarder · `Ctrl+F` rechercher dans le fichier
- Aperçu Markdown rendu · Preview image inline (PNG, JPEG, GIF, WebP, SVG…)
- **Viewer archives** (ZIP, TAR.GZ, TAR.BZ2, TAR.XZ, RAR, 7Z) + extraction (ici ou chemin custom)
- **Tableaux** CSV/TSV/XLSX/XLS/ODS avec filtre live
- Gros fichiers (>1 Mo) : chunks 512 Ko, lecture seule, zéro freeze
- Fichiers sans extension reconnue : éditables (texte brut)

## Stack

- **Tauri v2** (Rust) + **React 19** + **TypeScript** + **Tailwind v4**
- **CodeMirror 6** · **react-markdown** · **SheetJS** · **devicon**
- Archives : `zip`, `tar`, `flate2`, `bzip2`, `xz2` + `7z` système
- Build release : binaire standalone

## Installation

### Prérequis (Arch Linux)

```bash
# webkit2gtk-4.1, gtk3, rust, bun — déjà présents sur une workstation Hyprland standard
pacman -S webkit2gtk-4.1 gtk3 base-devel
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### Build

```bash
git clone https://github.com/trinityUwU/vela
cd vela
bun install
bun run tauri build
```

### Installer le binaire

```bash
# Wrapper avec fix WebKit/Wayland (Nvidia)
cat > ~/.local/bin/vela << 'EOF'
#!/usr/bin/env bash
exec env WEBKIT_DISABLE_DMABUF_RENDERER=1 /path/to/vela/src-tauri/target/release/vela "$@"
EOF
chmod +x ~/.local/bin/vela
```

### Raccourci Hyprland

```
bind = SUPER, E, exec, /home/$USER/.local/bin/vela
```

## Dev

```bash
bun install
./start.sh       # lance tauri dev, logs dans logs/dev.log
./stop.sh
./restart.sh
```

Port dev : **1430** (pour éviter les conflits avec d'autres apps Vite sur 1420).

## Note WebKit + Wayland (Nvidia)

Le renderer DMABUF de WebKitGTK crashe sur certaines configs Nvidia + Wayland. Le wrapper `~/.local/bin/vela` intègre `WEBKIT_DISABLE_DMABUF_RENDERER=1` pour y remédier.
