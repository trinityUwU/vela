# Vela

File manager Linux en deux modes : navigation classique et édition intégrée. En mode Édition, un clic sur un fichier l'ouvre dans la fenêtre — CodeMirror avec coloration syntaxique, sauvegarde `Ctrl+S`, aperçu Markdown live. Zéro dépendance réseau.

## Pourquoi

Nemo n'a jamais intégré de preview pane. Vela le fait nativement, avec un vrai éditeur, sans fork à maintenir.

## Fonctionnalités

**Mode Fichiers**
- Navigation grille avec icônes par format (logos devicon + SVG génériques)
- Sidebar : Favoris (pins + groupes collapsibles), Emplacements XDG, Montages
- Breadcrumb éditable (clic → saisie chemin directe)
- Recherche live dans le dossier (debounce 500ms, 150 résultats)
- Tri configurable : nom, date, taille, type — ASC/DESC, dossiers en tête — persisté entre sessions
- Filtre : Tout / Dossiers / Fichiers
- CRUD : nouveau fichier, nouveau dossier, renommer, supprimer
- Drag & drop : fichiers/dossiers vers dossiers, crumbs du chemin, sidebar
- Clic droit fichier : ouvrir, copier le chemin absolu, copier le chemin relatif, renommer, supprimer, propriétés
- Clic droit zone vide : nouveau fichier/dossier, actualiser, toggle fichiers cachés, épingler le dossier, propriétés

**Mode Édition**
- Split liste / éditeur
- CodeMirror 6 (Python, JS/TS, Rust, HTML, CSS, JSON, Markdown, Go, PHP...)
- `Ctrl+S` sauvegarder · `Ctrl+F` rechercher dans le fichier
- Aperçu Markdown rendu · Preview image inline (PNG, JPEG, GIF, WebP, SVG...)
- Viewer archives (ZIP, TAR.GZ, TAR.BZ2, TAR.XZ, RAR, 7Z) + extraction (ici ou chemin custom)
- Tableaux CSV/TSV/XLSX/XLS/ODS avec filtre live
- Gros fichiers (> 1 Mo) : chunks 512 Ko, zéro freeze
- Fichiers sans extension reconnue : éditables (texte brut)

**Propriétés (clic droit)**
- Métadonnées : extension, emplacement, permissions Unix
- Contenu dossier : éléments directs, fichiers et dossiers en récursif, taille totale
- App par défaut : MIME détecté par extension (cohérent cross-fichiers), liste complète des apps installées, scan PATH complet, commande personnalisée (`/usr/bin/monapp %f`)

**Outils média (clic droit → « Éditer l'image… / Outils audio… / Outils vidéo… »)**

Le fichier s'ouvre dans le viewer avec un HUD d'édition docké (toggle via le bouton sliders de la barre). Modèle « ouvre → paramètre → exporte », sans timeline. Tout est local (ffmpeg, crate `image`, demucs).

- **Image** — édition accumulée avec aperçu live : recadrer, pivoter (90/180/270), retourner, redimensionner, ajuster (luminosité/contraste/saturation). On empile les opérations puis **un seul bouton Sauvegarder** rejoue la séquence en un fichier `_edited` (non destructif, format origine/png/jpg/webp + qualité).
- **Audio** — découper (sans réencodage), fondu entrée/sortie, normaliser (loudnorm), convertir (mp3/flac/wav/ogg/m4a + bitrate), supprimer la voix (rapide, filtre center-removal sans IA), et **séparation de stems via demucs** (voix/batterie/basse/autres ou voix+accompagnement, GPU si CUDA dispo). demucs est optionnel : installé automatiquement par `install.sh`, ou à la demande depuis le panneau.
- **Vidéo** — découper (sans réencodage), convertir/compresser (CRF, job background avec progression + annulation), extraire une image (timestamp → png), extraire l'audio (m4a/mp3/wav).

**Téléchargeur (Sidebar → Système → « Télécharger… »)**

Coller une URL YouTube ou Spotify → télécharger sans passer par un site de conversion en ligne. 100 % local (yt-dlp + spotdl).
- Détection automatique titre unique vs playlist. Playlist → liste des morceaux (chargement progressif au-delà de 10, scroll), tout sélectionner / désélectionner / au cas par cas.
- Choix du format / qualité / langue audio / sous-titres (parmi ceux disponibles), ou extraction audio seule (mp3/flac/wav/m4a/opus).
- Destination = dossier courant par défaut, modifiable, avec option « créer un nouveau dossier ».
- Téléchargement par lot, progression et annulation par morceau.
- Spotify : pas de téléchargement direct (DRM) — spotdl résout le titre et récupère l'équivalent. yt-dlp + spotdl sont installés automatiquement par `install.sh`.

## Stack

- **Tauri v2** (Rust) + **React 19** + **TypeScript** + **Tailwind v4**
- **CodeMirror 6** · **react-markdown** · **SheetJS** · **devicon**
- Archives : `zip`, `tar`, `flate2`, `bzip2`, `xz2` + `7z` système
- MIME : `mime_guess` (extension) + `xdg-mime` (fallback)
- Lecteur vidéo/audio : **GStreamer** (décodage GPU, contourne `<video>` WebKitGTK)
- Outils média : **ffmpeg/ffprobe** (audio/vidéo), crate **`image`** (image), **demucs** + torch/torchcodec (séparation de stems, venv dédié)

## Limitation connue — WebKit vs GTK natif

Le backend est en Rust, rapide. L'interface est rendue par WebKitGTK : un moteur de navigateur embarqué, pas des widgets GTK natifs. Nemo et Thunar, écrits en C, s'appuient directement sur GTK — moins de RAM, démarrage plus rapide, pas de couche intermédiaire.

En pratique ça se sent au lancement et sur les dossiers à plusieurs milliers d'entrées. C'est le prix de CodeMirror, des previews inline et du dark theme cohérent — des choses difficiles à faire proprement en GTK pur. Le trade-off est assumé.

## Installation

### Prérequis (Arch Linux)

```bash
# webkit2gtk-4.1, gtk3, rust, bun — déjà présents sur une workstation Hyprland standard
pacman -S webkit2gtk-4.1 gtk3 base-devel
# Média : GStreamer (lecteur), ffmpeg (outils audio/vidéo), python (demucs optionnel)
pacman -S gst-plugins-base gst-plugins-good gst-plugins-bad gst-libav ffmpeg python
curl -fsSL https://bun.sh/install | bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

`install.sh` installe aussi demucs (séparation de stems) dans un venv dédié `~/.local/share/vela/demucs-venv` — torch ~3 Go au premier run. Opt-out : `VELA_SKIP_STEMS=1 ./install.sh`. Vela fonctionne sans (la séparation s'affiche « non installée », installable depuis le panneau).

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
