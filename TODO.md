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

## Livré — v1.4 (refonte interactions)

- [x] Sélection multiple (Ctrl+clic, Shift+clic, Ctrl+A, Échap) — `selection: Set<string>`
- [x] Menu contextuel mono/multi (compteur, actions groupées)
- [x] Copier / couper / coller (Ctrl+C/X/V) — presse-papier interne + `copy_entries`/`move_entries` Rust
- [x] Corbeille XDG (`trash_entries`, crate `trash`) — Suppr → corbeille, Shift+Suppr → définitif
- [x] Compression vers archive (ZIP / TAR.GZ) depuis sélection — `create_archive` Rust
- [x] Suppression / déplacement groupés (drag de sélection multiple inclus)
- [x] Raccourcis clavier (F2, F5, Suppr/Shift+Suppr, Ctrl+A/C/X/V/F, Espace, Échap)
- [x] Persistance session (dernier dossier, mode, hidden) — localStorage `vela-session`
- [x] Watch live dossier (crate `notify` → event `fs-changed` → refresh debounce 250ms)
- [x] Recherche dans le contenu des fichiers (grep récursif) — `search_content`, toggle Nom/Contenu
- [x] Quick Look (Espace → overlay viewer sans mode Édition)
- [x] Renommage par lot (rechercher/remplacer + jeton `{n}`, aperçu live)
- [x] Corbeille dans la sidebar (badge compteur, ouvrir, clic droit → vider) — `trash_dir`/`trash_count`/`empty_trash`
- [x] Bouton « Vider (N) » dans la topbar quand cwd = corbeille (clic droit conservé en parallèle)
- [x] Fix outline focus navigateur (`:focus`/`:focus-visible` → `outline:none` global)

---

## Livré — v1.5 (aperçus + transferts robustes)

- [x] Indicateur de progression copie/déplacement (event `transfer-progress`, panel bas-droite)
- [x] Suivi **en octets** (copie par chunks 1 Mo) — déclenché si ≥8 fichiers OU ≥100 Mo
- [x] Pause / Reprise / Annulation des copies (`TransferManager`, nettoyage du partiel)
- [x] Déplacement annulable + restauration ; **cross-device** = copie pausable + suppression source différée
- [x] Aperçu PDF (pdf.js worker local, zoom, lazy >20 pages) → dispo en Quick Look
- [x] Thumbnails images (crate `image`, cache `~/.cache/vela/thumbs`, lazy IntersectionObserver, concurrence 4)
- [x] Aperçu HTML rendu (iframe sandboxée) comme le Markdown

---

# Livré — v1.6 : Terminal intégré ✅

**Décisions actées** : multi-onglets dès la v1 · sync cwd = bouton manuel « suivre » (lancement dans
le cwd + resync à la demande) · PTY réel `portable-pty` + `xterm.js` · panneau bas dévoilable.

**Backend** (`terminal.rs`) : `TerminalManager` (state, `HashMap<id, Session>`). Session = master PTY +
writer + child. Commandes : `term_open(cwd)→id` (spawn `$SHELL` via portable-pty, thread lecteur →
event `term-output {id, data b64}`), `term_input(id, data)`, `term_resize(id, cols, rows)`,
`term_close(id)`. EOF shell → event `term-exit {id}`.

**Frontend** : `useTerminals` (Map sessions, onglet actif), `TerminalPanel.tsx` (barre d'onglets +
xterm.js par session, `@xterm/addon-fit`, écoute `term-output`/`term-exit`, envoie frappes via
`term_input`, resize via addon-fit → `term_resize`). Toggle Ctrl+` + bouton topbar, hauteur drag.
Bouton « suivre » = `term_input(id, "cd '<cwd>'\\n")`.

**Deps** : `portable-pty` (Rust, wezterm, MIT) · `@xterm/xterm` + `@xterm/addon-fit` (JS, MIT, local).

## 1 · Indicateur de progression copie / déplacement  ✅ LIVRÉ

**Objectif** : sur une copie/déplacement volumineux, l'UI ne doit plus paraître figée. Réutilise
intégralement le pattern existant `ExtractionManager` + events Tauri + `ExtractionPanel`.

**Backend** (`ops.rs`)
- `copy_entries` / `move_entries` deviennent **async** (`tauri::async_runtime::spawn`), reçoivent
  `app: AppHandle` pour émettre un event `transfer-progress`.
- Pré-comptage : `walkdir` pour compter le nombre total de fichiers à traiter → `total`.
- Émettre `transfer-progress` à chaque fichier copié : payload `{ job_id, kind: "copy"|"move", current, total, status, error }`
  (même forme que `ProgressPayload` de archive.rs — statuts : `transferring` | `done` | `error`).
- `job_id` = uuid simple (timestamp + compteur, ou crate `uuid` déjà transitive — vérifier, sinon
  format `transfer-{millis}`).
- Garder une version synchrone interne `copy_recursive` (déjà là). Le wrapper async boucle dessus
  en émettant la progression entre chaque entrée racine ET idéalement par fichier (passer un
  callback `on_file` à `copy_recursive`).
- **Pas de pause/annulation en v1** (option v2). Juste la barre de progression.

**Frontend**
- `src/types.ts` : `TransferStatus = "transferring" | "done" | "error"`, `TransferJob { id, kind, current, total, status, error? }`.
- `src/hooks/useTransfers.ts` : calqué EXACTEMENT sur `useExtractions.ts` — écoute `transfer-progress`,
  maintient `Map<id, TransferJob>`, auto-dismiss 6 s sur état terminal.
- `src/services/fs.ts` : `copyEntries`/`moveEntries` renvoient déjà void ; le suivi passe par events.
- **Réutiliser `ExtractionPanel`** : soit le généraliser pour empiler extractions + transferts (préféré),
  soit créer `TransferPanel.tsx` jumeau. Si généralisation : renommer en `ActivityPanel` qui prend
  `jobs: (ExtractionJob | TransferJob)[]` et affiche libellé selon le type.
- `App.tsx` : monter `useTransfers`, passer au panel.
- Le `paste` de `useFileManager` (cut → moveEntries, copy → copyEntries) bénéficie automatiquement
  de la barre puisque le backend émet les events.

**Fichiers** : `ops.rs`, `lib.rs` (passer AppHandle aux commandes — déjà le cas pour watch_dir),
`types.ts`, `useTransfers.ts` (nouveau), `ExtractionPanel.tsx` (généralisation), `App.tsx`.

**Risque** : double émission / flicker si `total` mal compté. Tester avec un dossier ~5000 fichiers.

---

## 2 · Aperçu PDF  ✅ LIVRÉ

**Objectif** : afficher les PDF dans l'éditeur (et donc gratuitement dans Quick Look).

**Dépendance** : `pdfjs-dist` (npm, `bun add pdfjs-dist`). Worker servi **en local** (souveraineté :
zéro CDN) via import Vite `pdfjs-dist/build/pdf.worker.min.mjs?url`.

**Frontend uniquement**
- `src/services/file-kind.ts` : ajouter `"pdf"` au type `Preview`, mapper l'extension `pdf` →
  `previewKind === "pdf"`. Retirer `pdf` d'éventuels sets binaires. `isEditable("pdf")` doit
  rester **false** (lecture seule, pas d'édition CodeMirror).
- `src/components/PdfViewer.tsx` (nouveau) :
  - Lit le fichier via `read_file_base64` (commande déjà existante) → `Uint8Array`.
  - `pdfjsLib.getDocument({ data })` ; configurer `GlobalWorkerOptions.workerSrc = workerUrl`.
  - Rendu page par page sur des `<canvas>` empilés verticalement, scroll dans un conteneur `flex-1 overflow-auto`.
  - Contrôles : zoom +/- (scale 0.5→3), indicateur page courante/total. Render à `scale * devicePixelRatio`.
  - Lazy render des pages visibles (IntersectionObserver) si > 20 pages.
  - Gestion erreur (PDF corrompu / chiffré) → message via `onError`.
- `src/components/Editor.tsx` : brancher `kind === "pdf"` → `<PdfViewer entry={entry} onError={onError} />`
  (avant les autres branches isImage/isArchive). Masquer les boutons save/search pour ce type.

**Fichiers** : `package.json`, `file-kind.ts`, `PdfViewer.tsx` (nouveau), `Editor.tsx`,
`vite.config.ts` (vérifier que le worker `?url` est bien bundlé, sinon `optimizeDeps`/`assetsInclude`).

**Risque** : plomberie worker pdf.js avec Vite + Tauri (chemin asset). ~30 min connues. Tester avec
un PDF multi-pages et un PDF lourd (>10 Mo).

---

## 3 · Thumbnails images (mode Fichiers)  ✅ LIVRÉ

**Objectif** : miniatures réelles pour les images dans la grille, au lieu de l'icône générique.

**Dépendance** : `image = "0.25"` (Rust).

**Backend** (`thumbs.rs`, nouveau module)
- Commande `thumbnail(path: String, max: u32) -> Result<String, String>` (base64 d'un WebP ou PNG).
  - **Cache disque** : `~/.cache/vela/thumbs/{hash}.webp` où `hash = blake3/sha(path + mtime + max)`.
    Clé incluant mtime → invalidation automatique si l'image change. Lire le cache avant toute génération.
  - Décodage `image::open`, resize `Lanczos3` cap dimension `max` (défaut 128px), encode WebP (ou PNG si webp indispo).
  - Async via `spawn_blocking`. Skip si fichier > 20 Mo (retourne Err → fallback icône front).
  - Créer `~/.cache/vela/thumbs/` au besoin.
- Enregistrer dans `lib.rs`.

**Frontend**
- `src/services/fs.ts` : `thumbnail(path, max=128): Promise<string>`.
- `src/hooks/useThumbnail.ts` (nouveau) : lazy via **IntersectionObserver** — ne génère QUE les
  tuiles visibles. Limite de **concurrence ~4** générations en parallèle (queue) pour ne pas saturer
  sur un dossier de 500 images. Retourne `{ src, loading, error }`.
- `src/components/FileTile.tsx` : si `previewKind(entry.extension) === "image"`, afficher le thumbnail
  (img base64) à la place de `FileIcon` ; fallback `FileIcon` pendant chargement / si erreur.
  Garder un ref sur la tuile pour l'IntersectionObserver.

**Fichiers** : `Cargo.toml`, `thumbs.rs` (nouveau), `lib.rs`, `fs.ts`, `useThumbnail.ts` (nouveau), `FileTile.tsx`.

**Risque** : dossier plein de RAW lourds → skip > 20 Mo + cache. Concurrence à plafonner.
Mémoire : ne pas garder toutes les base64 en RAM, laisser le GC ; le cache disque est la source.

---

## Livré — v1.7 (annulation + onglets éditeur + Réglages) ✅
- [x] Annuler (Ctrl+Z) — pile inverse renommage/déplacement/copie/corbeille (`useUndo` + `restore_trash`)
- [x] Onglets multi-fichiers en mode Édition (`useEditorTabs` + `EditorArea`, éditions préservées)
- [x] Catégorie Réglages dans la sidebar — référence des features + raccourcis (`SettingsPanel`)

## Livré — v1.8 (comparaison + étiquettes couleur) ✅
- [x] Diff entre deux fichiers (CodeMirror MergeView) — sélection 2 fichiers → clic droit « Comparer »
- [x] Tags / couleurs sur fichiers (palette 7 couleurs, `~/.config/vela/tags.json`, swatches menu contextuel)

## Livré — v1.9 (ergonomie navigation) ✅
- [x] P1·1 — Vue liste détaillée triable (`FileTable`, colonnes Nom/Taille/Date/Type, tri en-tête, toggle topbar persisté `vela-view`)
- [x] P1·2 — Historique navigation (back/forward Alt+←/→, pile dans `useFileManager`, boutons topbar)
- [x] P1·3 — Navigation clavier (flèches + Entrée) — listener global capture phase + `e.code` (contournement WebKitGTK : focus boutons + scroll natif + naming `Up`/`ArrowUp`)
- [x] P1·4 — Ouvrir terminal ici (clic droit dossier → onglet PTY dans ce dossier)

## Livré — v1.10 ✅
- [x] Onglets terminaux : clic droit → renommer + pastille couleur (double-clic = renommer), état en mémoire

## Livré — v1.11 (P2 confort) ✅
- [x] P2·5 — Apparence : accent (6 presets) + densité (font-size rem), persisté `vela-appearance` (`useAppearance`)
- [x] P2·6 — Recherches récentes : 8 dernières persistées, champ vide → liste cliquable
- [x] P2·7 — Taille de dossier à la demande : clic droit → calcul, affiché colonne Taille
- [x] P2·8 — Analyse disque : `analyze_disk` (plus gros fichiers + doublons par hash), overlay `DiskAnalyzer`

## Livré — v1.12 (P3 avancé) ✅
- [x] P3·9 — Aperçu vidéo/audio. Audio = blob `<audio>`. **Vidéo = lecteur natif GStreamer→canvas**
  (`player.rs` + `gstreamer-rs`, décodage GPU NVDEC, synchro A/V par horloge pipeline) car `<video>`
  WebKitGTK cassé sur Nvidia/Wayland. Contrôles play/pause/seek/volume/fullscreen auto-hide.
- [x] P3·10 — Comparaison de dossiers (`compare_dirs` + `DirCompareViewer`, clic droit 2 dossiers)

## Livré — v1.13 (lecteur audio natif immersif) ✅
- [x] Audio en lecture native GStreamer (abandon blob `<audio>` : seek mort + coupures ~4s)
  → `player_open_audio` (appsink PCM + autoaudiosink) + `player_position`
- [x] Spectre temps réel = FFT côté Rust via appsink + `spectrum-analyzer` (le bus GLib se figeait sous Tauri)
- [x] 4 visualizers commutables en direct : Barres / Ondes / Radial / Chaleur (heatmap) — persistés `vela-audioviz`
- [x] Layout immersif full-bleed (canvas ResizeObserver, vinyle centré, transport overlay bas)

## Livré — v1.14 (suite d'outils média + HUD d'édition) ✅
Backend Rust (5 modules, ~20 commandes, 20 tests cargo) :
- [x] `media_probe.rs` — détection capacités (ffmpeg/ffprobe/demucs) + sonde ffprobe (durée/streams)
- [x] `audio.rs` — trim (stream copy), fade in/out, normalize (loudnorm), convert (+bitrate), remove_vocals (filtre pan center-removal, sans IA)
- [x] `stems.rs` — séparation demucs (4 stems ou voix+accompagnement), venv `~/.local/share/vela/demucs-venv` détecté, install managée (demucs+torchcodec), job background + progress + cancel
- [x] `imaging.rs` — crop/rotate/flip/resize/adjust/convert + `image_apply_ops` (séquence d'ops accumulées → écriture unique)
- [x] `video.rs` — trim (sans réencodage), convert (CRF, job background + progress + cancel), extract_frame, extract_audio
Frontend :
- [x] `media.ts` + types (`ImageOp`), panneaux Audio/Image/Vidéo + `MediaToolsModal` (dispatch par previewKind)
- [x] **HUD d'édition docké** dans le viewer (Editor) : clic droit « Outils… » → ouvre en mode édition + HUD, toggle bouton sliders. Plus de modale.
- [x] **Image en édition accumulée** : ops empilées + preview CSS live cumulative + un seul Sauvegarder (`_edited`, non destructif)
- [x] install.sh : setup demucs auto (idempotent, opt-out `VELA_SKIP_STEMS=1`)

## Backlog
- [ ] Édition image en plein écran (remonter le HUD dans le conteneur fullscreen du lecteur pour préserver l'immersion)

### À discuter puis implémenter en session autonome (idées Chris — 2026-06-02)

**A · Téléchargement de fichiers volants (YouTube / Spotify)**
Réduire la friction « chercher un convertisseur en ligne ». Coller une URL → choisir format / qualité / langue audio / sous-titres parmi ceux disponibles → télécharger dans le cwd.
- Moteur : `yt-dlp` (open source, local, souverain). `yt-dlp -F <url>` liste les formats dispo → UI de sélection. Gère mp4/webm/mp3/wav, qualités, pistes audio par langue, sous-titres, extraction audio.
- Spotify : pas de download direct (DRM). `spotdl` lit les métadonnées Spotify (titre/artiste) et délègue à yt-dlp depuis YouTube → un seul moteur + couche de résolution.
- Archi pressentie : module `downloader.rs` (même pattern que `stems.rs` : binaire dans venv détecté, install managée optionnelle, job background + progress parse stdout yt-dlp + cancel).
- UI/UX (précisé Chris) :
  - Détection dynamique du type d'URL : titre unique vs playlist.
  - Playlist → afficher tous les titres ; si > 10, **chargement dynamique** (pas tout d'un coup), **scroll géré dans la modal**.
  - **Tout sélectionner / tout désélectionner** + sélection individuelle, puis un seul bouton Download → batch (file de jobs).
  - Choix format/qualité/langue audio/sous-titres parmi les dispo.
  - Destination : **cwd actuel par défaut**, modifiable dans la modal + case **« créer un nouveau dossier pour ce download »**.
- Légal : téléchargement de contenu sous copyright = zone grise. Usage perso machine Chris, hors prod Echo Agency. Mentionné, assumé.

**B · Profils + layout dynamique**
Remplacer/englober les 2 modes actuels (fichiers/édition) par des **profils** nommés et configurables (ex. profil « dev » = arborescence à gauche + éditeur au centre, reste masqué).
- **Un seul profil actif à la fois** (confirmé Chris) : un profil = un layout complet lié à ce profil, on switch de l'un à l'autre. → sélecteur de profil dans la barre du haut (déjà l'invariant), le reste se reconfigure.
- **Invariants non configurables** : barre du haut (switch profil + emplacement courant) = toujours visible, jamais déplaçable. Barre de filtres en bas = masquable par profil mais jamais déplaçable.
- **Archi (confirmée Chris)** : placement libre des sections proposées par l'app **mais PAS pixel-par-pixel** (drag free-form = KO, sur-ingénierie + casse l'épuré). → nombre **fini de zones** (gauche/centre/droite/bas) + catalogue de panneaux assignables (sidebar favoris, arborescence, filtres custom, terminal, éditeur) : par profil = quelle zone montre quoi + visible on/off + largeur.
- **Décision d'archi à trancher avant impl** : les profils deviennent-ils le concept de premier niveau (fichiers/édition = comportements de zones) plutôt que des modes globaux concurrents ?
- Exigence transverse : navigation ultra fluide, épurée, pro, sans se perdre dans des settings. L'édition de profils elle-même doit rester simple.

**Mode session suivante** : autonome, prendre ces features une à une (download d'abord = plus net et isolé, profils ensuite après décision d'archi).
