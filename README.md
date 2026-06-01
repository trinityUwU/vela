# Vela

File manager natif Linux avec deux modes : navigation classique et édition intégrée. En mode Édition, un clic sur un fichier l'ouvre directement dans la fenêtre — CodeMirror avec coloration syntaxique, sauvegarde `Ctrl+S`, aperçu Markdown live. Aucune dépendance réseau.

## Pourquoi

Nemo n'a jamais intégré de preview pane. Vela le fait nativement, avec un vrai éditeur, sans fork à maintenir.

## Fonctionnalités

- **Mode Fichiers** : navigation, grille d'icônes par format (logos langages), breadcrumb éditable, fichiers cachés, dossier parent
- **Mode Édition** : split liste/éditeur — clic simple pour ouvrir, `Ctrl+S` pour sauver, aperçu Markdown live
- **Icônes par format** : Python, JS, TS, Rust, Go, HTML, CSS, Markdown, JSON, archives…
- **Gros fichiers** : lecture par chunks 512 Ko, lecture seule au-delà de 1 Mo — zéro freeze
- **CRUD** : renommer, supprimer (confirmation), nouveau dossier via menu contextuel
- **Sidebar** : Home, dossiers XDG, points de montage détectés depuis `/proc/mounts`
- **Fenêtre immersive** : sans décoration native, draggable depuis la topbar
- **Raccourci** : `Super+E` (configurable Hyprland)

## Stack

- **Tauri v2** (Rust) + **React 19** + **TypeScript** + **Tailwind v4**
- **CodeMirror 6** (édition, 10+ langages) + **react-markdown** (aperçu)
- **devicon** pour les logos de langages
- Build release : ~13 Mo, binaire standalone

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
