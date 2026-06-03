# STATE — Vela

## Objectif
File manager Linux (Tauri v2 + React/TypeScript) avec **profils de layout** : chaque profil compose une disposition par zones (favoris, listing, éditeur, arborescence, terminal). Alternative souveraine à Nemo.

## État — v2.0 (fonctionnel, installé) · 114 commandes Rust

Historique détaillé par version plus bas. Le bloc qui suit décrit le socle v1.5 ; les incréments v1.6→v1.15 sont documentés dans leurs sections dédiées.

## v2.0 — « Effet waouh » ✅ LIVRÉ (specs dans TODO.md → section « ROADMAP v2 »)

Thèse : l'utilisateur exprime une intention (taper / sélectionner), Vela propose + exécute. 8 chantiers livrés
(tests verts, build deb+rpm, installé, palette validée à l'écran) :
0. **Refacto App.tsx** (500/500 lignes — prérequis dur, extraction `OverlayHost`)
1. **Palette `Ctrl+K`** — fuzzy fichiers + actions + lieux, registre unique généré (multiplicateur)
2. **Conversion universelle** — image (crate `image`)/doc (`pandoc`+`libreoffice`)/pdf (`printpdf`), tout local
3. **Actions contextuelles** — ContextMenu réactif au type collectif de la sélection (`smart-actions.ts`)
4. **Git visuel** — `git2`, badges sur les tuiles + nouveau panneau de zone `GitPanel` (réutilise `DiffViewer`)
5. **Recherche globale indexée** — index nom en mémoire, background, branché palette + search
6. **OCR** — `tesseract` (optionnel), clic droit image/PDF → texte
7. **Langage naturel local** — EchoHub `127.0.0.1:37821`, opt-in strict, désactivé par défaut

Contraintes transverses (détail TODO.md) : limites code (500/35/120, zéro `any`, try/catch+log), binaires
externes optionnels + dégradation gracieuse (pattern `media_capabilities`), quirks WebKitGTK (autofocus rAF,
`<select>` custom, clavier capture+`e.code`), validation hors Playwright (`cargo`/`bun tauri build`/`grim`),
rituel install `pkill -x vela-bin`, checkpoint git par chantier.

**Nouveaux modules Rust v2** : `convert.rs` (conversion universelle + `images_to_pdf`), `actions.rs`
(`merge_csv`/`organize_dir`), `git.rs` (git2 vendored, `git_status` async), `index.rs` (`SearchIndex`
managé, build background au setup), `ocr.rs` (tesseract, async). **Front v2** : `services/fuzzy.ts`,
`useCommandRegistry`/`useCommandPalette`/`CommandPalette`, `useGridNav`, `useGitStatus`/`GitPanel`,
`useNlSettings`/`services/nl.ts`, `useFileActions`, `OverlayHost`, `smart-actions.ts`,
`services/{convert,actions,git,search-index,ocr,path-util}.ts`. `PanelId` gagne `git`.
**Deps ajoutées** : `printpdf 0.7`, `git2 0.19` (vendored). Binaires optionnels : pandoc, libreoffice,
tesseract, pdftoppm (détectés, non installés auto).

## Socle — v1.5

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

**Commandes Rust** : 55 enregistrées dans `lib.rs` (manage `ExtractionManager` + `DirWatcher` + `TransferManager` + `TerminalManager`)

**Transferts contrôlables** : `TransferManager` (state, AtomicBool paused/cancelled par job) + `transfer_pause`/`transfer_resume`/`transfer_cancel`. La boucle de copie par chunks vérifie le contrôle à chaque tranche (pause = spin-wait 50 ms, annulation = nettoyage du partiel + statut `cancelled`). Boutons Pause/Reprendre + Annuler sur copie ET déplacement. **Déplacement intelligent** : `rename` si même FS (instantané) ; sinon (cross-device EXDEV) copie par chunks pausable/annulable + suppression de la source **différée à la fin** (annuler ne perd jamais de données). Annulation = restauration : rename inverse des renommés, suppression des copies cross-device partielles. `MoveState` (renamed/copied), `undo_move`, `is_cross_device`, `validate_move_target`

**Infra**
- Build + install : **`./install.sh`** (build release, `pkill -x vela-bin`, cp, smoke test) — ne plus faire le rituel à la main
- Build : `bun tauri build` (targets: deb, rpm — AppImage exclu, linuxdeploy absent)
- Binaire : `~/.local/bin/vela-bin`, wrapper : `~/.local/bin/vela` (WEBKIT_DISABLE_DMABUF_RENDERER=1)
- Raccourci `Super+E` → `/home/trinity/.local/bin/vela`
- Port dev : 1430 (vite.config.ts + tauri.conf.json)
- GitHub : https://github.com/trinityUwU/vela (public)

## Piège infra connu — lecture vidéo WebKitGTK
L'élément HTML5 `<video>` est **inutilisable sur Nvidia/Wayland** (RTX 3060) : frame figée hors seek, écran noir, ou 2fps. Diagnostiqué à fond — décodage OK, codecs OK, c'est le compositing GL du calque vidéo qui ne se repeint pas. **Aucune** variable d'env ne corrige (testé : `WEBKIT_DISABLE_DMABUF_RENDERER`, `WEBKIT_DISABLE_COMPOSITING_MODE` → 2fps software, `GST_GL_DISABLED`, `GDK_BACKEND=x11`). Les mainteneurs Tauri classent ça bug non résolu. **Ne pas perdre de temps à réessayer `<video>` ou MSE** (MSE alimente aussi un `<video>` → même bug). La solution retenue = décodage Rust GStreamer → `<canvas>` (voir section v1.12 `player.rs`). **Idem audio** : le blob `<audio>` lit le son mais n'est **pas seekable** (blob URL sans byte-range) et bufferise mal (coupures ~4s). Abandonné en v1.13 → audio aussi décodé par GStreamer natif.
**Nuance navigateur intégré (v1.17)** : dans les webviews wry du navigateur, la vidéo (YouTube) **fonctionne** en posant `HardwareAccelerationPolicy::Never` sur le webview (rendu software). Sans ça → crash de l'app à la lecture. C'est un réglage par-webview, pas une variable d'env globale (qui dégraderait toute l'UI).

## Piège infra connu — install release
- **NE JAMAIS** faire `pkill -f vela-bin` : le motif `-f` matche la ligne de commande du script/commande courante (qui contient « vela-bin ») et **tue le shell avant le `cp`** → le nouveau binaire n'est jamais installé, on relance l'ancien. Ce bug a coûté 1h le 2026-06-02 (la nav clavier semblait cassée alors que les correctifs n'étaient simplement jamais déployés). Toujours `pkill -x vela-bin` (nom de process exact). Rituel figé dans `install.sh`.

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

## v1.5 — livré ✅
Aperçus (PDF, HTML, thumbnails) + transferts robustes (progression octets, pause/annulation copie & déplacement, cross-device). Détail dans `TODO.md` section « Livré — v1.5 ».

## v1.6 — Terminal intégré ✅ (livré, installé)
- `terminal.rs` : `TerminalManager` (state, `HashMap<id, Session>`). Session = master PTY + writer + child. Commandes `term_open(cwd, cols, rows)→id` (spawn `$SHELL` via `portable-pty`, `TERM=xterm-256color`, thread lecteur → event `term-output {id, data b64}`), `term_input`, `term_resize`, `term_close`. EOF shell → event `term-exit {id}`.
- Front : `useTerminals` (onglets multi-sessions, actif), `TerminalPanel.tsx` (barre d'onglets + xterm.js par session via `@xterm/addon-fit`, écoute `term-output`/`term-exit`, frappes → `term_input`, ResizeObserver → `term_resize`). Panneau bas redimensionnable (`ResizeHandle` drag), toggle **Ctrl+`** + bouton topbar. Bouton **« Suivre »** = `cd '<cwd>'` injecté dans la session active.
- Bannière d'accueil (cwd + date, sans mention produit) écrite dans le pane au montage. Fit robuste via double `requestAnimationFrame` (le prompt s'affiche sans resize manuel).
- **Choix du shell** : `available_shells` (parse `/etc/shells`, existants, dédup par nom, exclut nologin/git-shell/rbash/fallback) ; bouton `▾` (hors zone scrollable pour éviter le clip overflow) → menu des shells (bash/zsh…). `+` = `$SHELL` par défaut, `term_open(shell?)`.
- **Police** : `JetBrainsMono Nerd Font` dans xterm → glyphes Powerlevel10k/powerline rendus (sinon carrés).
- Deps : `portable-pty` (Rust) + `@xterm/xterm` + `@xterm/addon-fit` (local).

## v1.7 — Annulation, onglets éditeur, Réglages ✅ (livré, installé)
- **Ctrl+Z** (`useUndo`) : pile multi-niveaux (30) — renommage, déplacement, copie, mise en corbeille. Réversibilité : rename inverse · re-déplacement vers le parent d'origine (regroupé par dossier source) · copies → corbeille · restauration corbeille. Backend : `restore_trash` (`trash::os_limited::restore_all`, match sur chemin d'origine) + `copy_entries` retourne désormais les chemins créés. Enregistrement des ops via `recordRef` dans `useFileManager` (branché depuis `App` → `setRecorder`).
- **Onglets multi-fichiers en mode Édition** (`useEditorTabs` + `EditorArea`) : un `Editor` monté par onglet, inactifs masqués (CSS) → **éditions non sauvegardées préservées au changement d'onglet**. Fermeture × ou clic-milieu. `Editor` reçoit `active` → Ctrl+S/Ctrl+F ne s'appliquent qu'à l'onglet visible. `navigate` ne remet plus `opened=null` (onglets indépendants du listing → on browse sans perdre les fichiers ouverts).
- **Réglages** (`SettingsPanel`) : bouton engrenage dans la section Système de la sidebar → overlay référençant toutes les features groupées + raccourcis en `<kbd>`. Fermeture Échap/clic dehors.

## v1.8 — Comparaison & étiquettes couleur ✅ (livré, installé)
- **Diff 2 fichiers** (`components/DiffViewer.tsx`) : overlay `MergeView` (`@codemirror/merge`) côte à côte, lecture seule, coloration syntaxique via `langExtension`. Déclenché par sélection de 2 fichiers → clic droit « Comparer les 2 fichiers » (`ContextMenu` affiche l'item si `count===2` ; `App.compareSelection` valide que les deux ne sont pas des dossiers).
- **Étiquettes couleur** (`tags.rs` + `services/tags.ts` + `useTags`) : palette sémantique de 7 couleurs persistée dans `~/.config/vela/tags.json` (path → clé couleur). Commandes `load_tags`/`set_tag(paths, color)` (color vide = retrait, applicable à une sélection multiple). UI : rangée de swatches dans le `ContextMenu` (+ ✕ pour retirer) ; pastille d'angle sur `FileTile` (grille) et point sur `FileRow` (liste Édition). `App` convertit clé→hex via `hexFor` avant de passer `colorOf` aux vues.

## v1.9 — Ergonomie navigation ✅ (livré, installé)
- **Vue liste détaillée** (`components/FileTable.tsx`) : colonnes Nom/Taille/Date/Type, tri au clic d'en-tête (`onToggleBy` → `useSort`), indicateur ▲/▼ sur la colonne active. Drag-drop + sélection identiques à la grille. Bascule grille ↔ liste via bouton topbar (icône `GridIcon`/`ListIcon`), persistée localStorage `vela-view` (state dans `App`).
- **Historique de navigation** (`useFileManager`) : pile `history` + index `histIdx` (refs). `navigateInternal(path, fromHistory)` empile uniquement les navigations utilisateur (refresh/showHidden re-navigation = même path, pas d'empilement). `goBack`/`goForward` + flags `canBack`/`canForward`. Boutons topbar (chevrons, désactivés en bout de pile) + **Alt+←/→**.
- **Navigation clavier** (`App`, listener global **capture phase**) : flèches déplacent la sélection, **Entrée** ouvre l'élément actif (`activateSel`). En grille = 2D (↑/↓ sautent une ligne via `gridCols` mesuré dans `FileGrid`), en liste/Édition = vertical seul. La tuile active fait `scrollIntoView`.
  - **Pourquoi capture phase + `e.code`** : (1) WebKitGTK ne donne pas le focus aux `<button>` au clic → un `onKeyDown` sur la tuile/conteneur ne se déclenche jamais de façon fiable. (2) Un `preventDefault` en phase *bubble* n'annule pas le scroll natif du conteneur. (3) `e.key` peut valoir `"Up"` au lieu de `"ArrowUp"` selon la variante WebKitGTK → on teste `e.code` (position physique) en priorité. Un listener `window` en capture, indépendant du focus, résout les trois.
- **Ouvrir un terminal ici** : item `ContextMenu` (dossier mono-sélection) → `openTerminalHere(path)` ouvre un onglet PTY dans ce dossier + déploie le panneau.

## v1.10 — Onglets terminaux personnalisables ✅ (livré, installé)
- Clic droit sur un onglet terminal → menu : **Renommer** + rangée de pastilles (palette `TAG_COLORS` partagée) + ✕ pour retirer. Double-clic sur l'onglet = renommage inline. Pastille couleur affichée à gauche du titre.
- État en mémoire seulement (`useTerminals.rename`/`setColor`, champ `color?` sur `TermTab`) — les sessions PTY sont éphémères, aucune persistance disque pertinente. Réutilise `hexFor`/`TAG_COLORS` de `services/tags.ts`.

## v1.11 — P2 confort ✅ (livré, installé)
- **Apparence** (`useAppearance` + section interactive dans `SettingsPanel`) : couleur d'accent (6 presets) → override runtime `--color-accent` + `--color-accent-dim` (dérivé par `darken()`) sur `document.documentElement` ; densité compact/normal/confort = `html { font-size }` 14/15/16px (le spacing Tailwind en rem scale proportionnellement). Persisté `vela-appearance`.
- **Recherches récentes** (`useSearch`) : 8 dernières `{q, mode}` persistées `vela-search-recents`, poussées après chaque recherche aboutie ; champ vide → overlay liste cliquable (rejoue q+mode), bouton Effacer.
- **Taille de dossier à la demande** : clic droit dossier → « Calculer la taille » → `get_entry_props` (taille récursive déjà existante) → `folderSizes` map dans `App` → affichée dans la colonne Taille de `FileTable` (vue liste).
- **Analyse disque** (`analyze.rs` → `analyze_disk` + `DiskAnalyzer.tsx`) : `walkdir` collecte tailles → top 40 plus gros fichiers + doublons (groupés par taille puis hash `DefaultHasher` std, cap 2 Go/fichier, dédup → groupes triés par espace récupérable). Overlay 2 onglets (plus gros / doublons), clic → navigue vers le dossier parent. Déclenché par clic droit dossier → « Analyser l'espace… ». Util de formatage partagé `services/format.ts` (`fmtSize`/`fmtDate`, factorisé depuis `FileTable`).

**Commandes Rust** : 48 (ajout `analyze_disk`).

## v1.12 — P3 avancé ✅ (livré, installé)
- **Aperçu vidéo/audio** (`MediaViewer.tsx`, `file-kind` types `video`/`audio`). Branché dans `Editor` (et Quick Look) ; `isEditable` inclut video/audio.
  - **Audio** : blob `<audio>` (lu via `read_file_base64` → Blob URL). Fonctionne.
  - **Vidéo : lecteur 100 % natif maison** (`player.rs` + `gstreamer-rs`). L'élément `<video>` de WebKitGTK est **cassé sur Nvidia/Wayland** (frame figée hors seek, écran noir — bug compositing GL confirmé, aucune variable d'env ne le corrige, voir [[piège infra]] ci-dessous). Solution : décodage **GStreamer côté Rust** (`playbin`, NVDEC GPU auto via nvcodec), video-sink custom `videoconvert ! videoscale (cap 1600px) ! jpegenc ! appsink sync=true`, frames JPEG poussées au front via **Channel Tauri** (`InvokeResponseBody::Raw`, payload = 8 octets f64 PTS LE + JPEG) → peintes sur `<canvas>` (`createImageBitmap` + `drawImage`). **Synchro A/V garantie par construction** : playbin joue l'audio (horloge maître), `appsink sync=true` libère chaque frame à son PTS exact — zéro drift. Contrôles : play/pause, seek (`player_seek`), volume (`player_set_volume` → property playbin), fullscreen applicatif (`fixed inset-0` + toolbar auto-hide 2,5s, curseur masqué — l'API Fullscreen navigateur est peu fiable sous WebKitGTK). Onglet caché → pipeline mise en pause (sinon l'audio continuerait). Fullscreen : canvas `w-full h-full object-contain` (remplit), windowed : `max-w/h-full` (n'agrandit pas).
  - Commandes : `player_open/pause/resume/seek/set_volume/close`. **PROTOCOLE ASSET TAURI ABANDONNÉ** (essayé puis retiré : ne sert pas les médias sous WebKitGTK + scope `**` = surface inutile).
  - Thumbnails vidéo **écartés** (ffmpeg/extraction = dép lourde, hors scope preview).
- **Comparaison de dossiers** (`dircmp.rs` → `compare_dirs` + `DirCompareViewer.tsx`) : `walkdir` sur 2 arbres → `BTreeMap<rel, meta>`, statut par entrée `only_a`/`only_b`/`modified` (taille OU mtime diff)/`same`. Overlay filtrable (Différences/Gauche/Droite/Modifiés/Identiques) avec signes −/+/~/= colorés. `App.compareSelection` route : 2 dossiers → `DirCompareViewer`, 2 fichiers → `DiffViewer`, mélange → erreur. Item menu renommé « Comparer les 2 éléments ».

**Commandes Rust** : 55 (ajout `compare_dirs` + 6 `player_*`).

## v1.13 — Lecteur audio natif immersif ✅ (livré, installé)
Refonte complète de l'aperçu audio (`AudioPlayer.tsx` extrait de `MediaViewer.tsx` ; `audio-viz.ts` pour les renderers).
- **Lecture native GStreamer** (abandon du blob `<audio>` : seek mort + coupures ~4s sous WebKitGTK). Nouvelle commande `player_open_audio(id, path, on_spectrum: Channel)` : `playbin` + **audio-sink custom** = `audioconvert ! audioresample ! audio/x-raw,format=F32LE,channels=1,rate=44100 ! tee → [appsink sync=true] + [autoaudiosink]`. Seek par horloge pipeline (parfait), zéro coupure. Réutilise `player_pause/resume/seek/set_volume/close`. Nouvelle commande `player_position(id)→f64` (la position vient de `query_position`, pas de frames côté audio → polling front 250ms).
- **Spectre = vrai FFT côté Rust** (pas le bus GLib). Piège : l'élément GStreamer `spectrum` poste sur le **bus**, or sous Tauri la main loop GLib ne pompe pas les messages bus à 30/s → le spectre se figeait après quelques frames. Solution = tap PCM via **appsink** (thread de streaming, fiable comme la vidéo) → FFT avec crate `spectrum-analyzer` (fenêtre Hann, 1024 samples) → 64 bandes log 30 Hz–16 kHz + **auto-gain** (peak décroissant ×0.992) → octets poussés au front via Channel.
- **4 visualizers commutables en direct** (`audio-viz.ts`, segmented control persisté `vela-audioviz`) : **Barres** (ancrées bas), **Ondes** (courbe remplie dégradé accent), **Radial** (barres en cercle autour du vinyle), **Chaleur** (spectrogramme heatmap défilant — X=temps via `shiftLeft` drawImage(-1,0), Y=fréquence, palette inferno). Tous consomment les mêmes 64 bandes ; modes continus lissés à 60fps (×0.35), spectro peint 1 colonne par frame reçue (via `seqRef`).
- **Layout immersif full-bleed** : `<canvas absolute inset-0>` dimensionné dynamiquement (ResizeObserver → buffer = taille réelle, net), vinyle centré pièce maîtresse (spin CSS 8s pendant lecture), sélecteur de mode haut (backdrop-blur), transport en overlay bas sur dégradé noir.

**Commandes Rust** : 57 (ajout `player_open_audio` + `player_position`). Dépendance ajoutée : `spectrum-analyzer = "1.5"`.

## v1.14 — Suite d'outils média + HUD d'édition ✅ (livré, installé)
Édition image/audio/vidéo intégrée au file manager, 100 % local. Modèle « ouvre → paramètre → exporte », pas de timeline.
- **Backend (5 modules, 20 tests cargo)** :
  - `media_probe.rs` — `media_capabilities()` (détection ffmpeg/ffprobe/demucs + `demucs_executable()` réutilisable) ; `media_probe(path)` (ffprobe JSON → durée/streams/codecs).
  - `audio.rs` — `audio_trim` (stream copy), `audio_fade` (afade in/out), `audio_normalize` (loudnorm), `audio_convert` (+bitrate), `audio_remove_vocals` (filtre `pan` center-removal, instantané, sans IA). Pattern thin async → `spawn_blocking` → sync `do_*` (testable).
  - `stems.rs` — `stems_status`, `stems_separate` (demucs `-n htdemucs --out`, 4 stems ou `--two-stems`, thread + parse `%` stderr + emit `stems-progress` + cancel), `stems_install` (venv `~/.local/share/vela/demucs-venv` + `pip install demucs torchcodec`, emit `stems-install-progress`), `stems_cancel`. demucs optionnel ; **torchcodec requis** (torchaudio récent délègue l'écriture audio à TorchCodec, sinon ImportError au save).
  - `imaging.rs` — crop/rotate/flip/resize/adjust/convert (crate `image`) + **`image_apply_ops(input, output, ops[], quality?)`** : enum `ImageOp` serde, application en mémoire de la séquence puis **écriture unique** (cœur de l'édition accumulée).
  - `video.rs` — `video_trim` (stream copy, snappe au keyframe), `video_extract_frame`, `video_extract_audio` (quick, spawn_blocking) ; `video_convert` (re-encode CRF, `VideoJobManager` + thread + `ffmpeg -progress pipe:1` → emit `video-progress` + cancel).
- **Frontend** :
  - `services/media.ts` + types (`ImageOp`, `MediaCapabilities`, etc.). Convention wire : retours snake_case, args invoke camelCase.
  - **HUD d'édition docké** : plus de modale. Clic droit « Éditer l'image… / Outils audio… / Outils vidéo… » → `App.onMediaTools` force `setMode("edit")` + `setOpened` + `editPath` → l'`Editor` ouvre le fichier et active le HUD (overlay bas-droite scrollable). Toggle via bouton **Sliders** dans la barre du viewer. `MediaToolsModal` route par `previewKind` ; panneaux Audio/Image/Vidéo ont une prop `embedded` (rendu docké sans backdrop).
  - **Image en édition accumulée** : `ImageToolsPanel` réécrit — on empile des `ImageOp` (preview CSS live cumulative : `transform` rotate/scale, `filter` brightness/contrast/saturate), annuler dernier / tout effacer, puis **un seul bouton Sauvegarder** → `image_apply_ops` → fichier `_edited` (non destructif, format origine/png/jpg/webp + qualité).
- **install.sh** : setup demucs automatique (idempotent, non bloquant, opt-out `VELA_SKIP_STEMS=1`).
- **Validation E2E** : `invoke` Tauri n'est pas drivable par Playwright (webview WebKitGTK ≠ Chromium). On valide par tests Rust `cargo test` (ops réelles sur fixtures) + `bun tauri build` + smoke-test du binaire réel. Séparation demucs validée end-to-end sur RTX 3060 (CUDA).

**Commandes Rust** : 67 (+10 : media_capabilities, media_probe, audio×5, stems×4 — image_apply_ops, video×5 répartis). Aucune dépendance crate ajoutée (ffmpeg/demucs = binaires externes ; `image` déjà présent).

## v1.15 — Téléchargeur YouTube/Spotify ✅ (livré, installé)
Téléchargement de fichiers volants intégré, 100 % local. Déclencheur Sidebar « Système → Télécharger… ».
- **Backend** : `downloader.rs` (capacités + sonde) + `download_job.rs` (jobs).
  - `download_capabilities` / `download_probe` = **async + spawn_blocking** (obligatoire : lancent yt-dlp/spotdl en réseau plusieurs secondes ; en synchrone ça figeait le thread Tauri → freeze/quasi-crash UI au sondage).
  - `download_probe` : yt-dlp `-J` → `DownloadInfo { kind, title, is_playlist, entries[], formats[], subtitle_langs[] }`. Distinction single vs playlist via `_type`/présence `entries`. Spotify : yt-dlp ne gère pas les URL Spotify → `spotdl save` → liste des pistes. Parsers purs `parse_ytdlp_json`/`parse_spotdl_json` (testés sur fixtures, validés contre la vraie sortie yt-dlp 2026.03.17 : single 31 formats + playlist 183 entrées).
  - `DownloadManager { Mutex<HashMap<job_id, Arc<AtomicBool>>> }` + `download_start` (thread, `yt-dlp --newline` → parse `%` stdout → emit `download-progress` {percent, speed, eta, status} ; cancel via flag) + `download_cancel`. spotdl n'émet pas de `%` → progression **indéterminée** (0 % au start, 100 % au done) → barre animée côté UI.
  - Résolution binaire **venv-first** `~/.local/share/vela/dl-venv/bin/{yt-dlp,spotdl}` puis PATH (modèle `demucs_executable`).
- **Frontend** : `services/download.ts` + types ; `DownloadModal.tsx` + `download-ui.tsx` + hook `use-download.ts`. URL → Sonder → affichage adaptatif (single vs playlist) ; playlist **lazy >10** (fenêtre +20) + **scroll** `max-h-[40vh]` + **select all/none/individuel** (`Set<string>`) ; format/qualité (single) + Audio seulement + audio-format + sous-titres (chips) ; destination cwd éditable + case « nouveau dossier » ; **batch** = 1 `job_id` par entrée, suivi via `listen("download-progress")`, barres + cancel. Select stylé `appearance-none` + chevron SVG (le `<select>` natif WebKitGTK rendait un chrome clair cassé).
- **install.sh** : yt-dlp + spotdl installés auto dans `dl-venv` (yt-dlp NON optionnel = moteur core ; non bloquant si échec).

**Commandes Rust** : 71 (+4 : download_capabilities, download_probe, download_start, download_cancel).

## v1.16 — Profils + layout dynamique ✅ (livré, installé)
Remplace les 2 modes (files|edit) par des **profils** nommés, chacun = un layout complet par zones. Architecture **Option A** (profils first-class : le `mode` disparaît au profit des zones).
- **Backend** : `profiles.rs` (modèle `favorites.rs`) — `load_profiles`/`save_profiles` → `~/.config/vela/profiles.json`. Types `PanelId` (enum serde lowercase : sidebar/listing/editor/filetree/terminal), `Zones {left, center, right, bottom}`, `Profile {id, name, zones, filter_bar_hidden}`, `ProfilesState {active, profiles}`. Seed par défaut : « Explorateur » {left:sidebar, center:listing} = ancien mode files ; « Édition » {left:sidebar, center:listing, right:editor} = ancien mode edit. **Non-régression garantie par les seeds.**
- **Frontend** :
  - `useProfiles.ts` (profil actif résolu, setActive/updateActive/upsert/remove, persistance debounce 400ms) + `services/profiles.ts`.
  - `useFileManager` : champ `mode`/`setMode` **retiré**, remplacé par `editorActive: boolean` + `setEditorActive`. `openEntry` décide inline/native sur `editorActive`. Session ne stocke plus `mode`.
  - `ZoneLayout.tsx` (NOUVEAU) : rend le centre selon `activeProfile.zones`. Règle listing : `editorActive` → FileList compact ; sinon FileGrid (grid) / FileTable (list). Reproduit exactement les 2 anciens modes.
  - `Topbar` : toggle mode remplacé par **sélecteur de profil** (segmented) + bouton Sliders → éditeur.
  - `FileTree.tsx` (NOUVEAU) : arborescence de dossiers pliable, lazy par expand (réutilise `listDir` filtré `is_dir`, cache enfants par path), cwd surligné. Aucune commande Rust ajoutée.
  - **Terminal en zone** : si un profil place `terminal` dans une zone (typiquement `bottom`), le `TerminalPanel` existant est rendu dans la zone (pas de dock legacy en double) ; sinon dock bas Ctrl+` inchangé.
  - `ProfileEditor.tsx` (NOUVEAU) : modale (modèle `SettingsPanel`) — créer/dupliquer/renommer/supprimer (min 1 profil), assigner un panneau à chaque zone via `<select>` (center obligatoire, autres « aucun »), toggle barre de filtres. `slugify` + id unique.
  - Extractions `DialogHost.tsx` + `ResizeHandle.tsx` (sortis de App.tsx pour rester < 500 lignes).
- **Validation** : tsc + cargo check verts, `bun tauri build` (deb+rpm), smoke-test binaire réel (boot 7s sans panic). Contrainte connue : `invoke` non drivable par Playwright (WebKitGTK ≠ Chromium).

**Commandes Rust** : 73 (+2 : load_profiles, save_profiles). Aucune dépendance crate ajoutée (xterm.js + portable-pty déjà présents pour le terminal).

## v1.17 — Navigateur intégré ✅ (livré, installé)
Navigateur web multi-onglets dans la zone centrale (bouton Globe topbar), vrai moteur WebKit, navigation libre. Toujours au centre quel que soit le profil actif.
- **Backend** : `browser.rs` (NOUVEAU, ~280 lignes, Linux uniquement, stubs `Err` sur autres OS). Commandes synchrones `browser_create/navigate/show/hide/eval/close/reset`.
  - **Positionnement — contournement bug Tauri #10420** : `add_child` (build_as_child) ne respecte PAS la géométrie des webviews enfants sur WebKitGTK/Wayland (rendu empilé). Solution : bypass total → webviews **wry** via `WebViewBuilder::new_with_web_context(ctx).build_gtk(&fixed)`. Un `gtk::Fixed` flottant est placé par un `gtk::Overlay` (le webview principal est reparenté comme enfant de base), positionné via le signal `connect_get_child_position` qui retourne les bounds de la zone centrale. wry ≥ 0.35.2 respecte les bounds dans un `gtk::Fixed` (≠ build_as_child).
  - **Threading** : commandes **synchrones** → exécutées sur le main thread (où vit GTK) → accès direct, état en `thread_local` (VIEWS, LAYER, CONTEXT, DATA_DIR). Pas de marshalling.
  - **Crash vidéo résolu** : la lecture vidéo crashait toute l'app (audio OK, image jamais composée). Cause = compositing GPU/DMABUF WebKitGTK. Fix : `HardwareAccelerationPolicy::Never` via `WebViewExt::settings()` posé **uniquement sur les webviews du navigateur** (UI principale reste accélérée). YouTube en software fonctionne — contrairement au `<video>` du player natif (voir piège infra).
  - **Persistance** : `wry::WebContext::new(Some(app_data_dir()/browser))` partagé par tous les onglets → cookies/sessions/localStorage survivent au redémarrage. `browser_reset` = clear views + drop contexte + `remove_dir_all` du dossier.
- **Frontend** : `useBrowser.ts` (modèle onglets + actions open/close/navigate/back/forward/reload/reset, écoute event `browser-nav`), `BrowserView.tsx` (chrome onglets + barre d'adresse + `useNativeSync` qui mesure les bounds via `getBoundingClientRect` et réconcilie la couche native via ResizeObserver), `services/browser.ts` (wrappers + `normalizeUrl`). `ZoneLayout` reçoit `centerOverride`. Bouton **Globe** dans `Topbar` (bouton « nouveau dossier » retiré au passage). Bouton **« Réinitialiser le navigateur »** dans `SettingsPanel`.
- **Refacto** : `TerminalDock.tsx` extrait d'`App.tsx` pour rester sous 500 lignes.
- **Déploiement** : `bun tauri build` (deb+rpm), `pkill -x vela-bin` + cp + sha256, relance. Validé à chaud : positionnement correct, vidéo YouTube OK, crash résolu.

**Commandes Rust** : 80 (+7 : browser×7). Deps Linux ajoutées : `wry 0.55`, `gtk 0.18`, `webkit2gtk 2.0` (cfg target_os=linux ; wry/gtk déjà transitifs via Tauri).

## Backlog
`BACKLOG.md` : P1 (v1.9) + P2 (v1.11) + P3 (v1.12) + P4 média (v1.14) + téléchargeur (v1.15) + profils (v1.16) livrés. Reste : édition image en plein écran (HUD dans conteneur fullscreen). Dette : `App.tsx` reste à ~499 lignes (sous la limite mais dense — candidat à découpage si une feature s'y ajoute).
