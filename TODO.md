# TODO — Vela

## Livré

- [x] v2.1 — Fix freeze compression (job async `start_compression`, pause/reprise/annulation)
- [x] v2.1 — Traducteur local Argos Translate (offline, sidecar, menu contextuel + modal)
- [x] v2.1 — CodeIndex intégré (recherche sémantique FR→EN, palette + modal)
- [x] v2.2 — Compression multi-formats (zip/targz/7z/rar) + mot de passe
- [x] v2.2 — Indexation CodeIndex async dans panneau bas-droite (pattern jobs longs réutilisable)
- [ ] v2.1 — Conversion de langages de programmation (MIS DE CÔTÉ — promesse intenable en l'état)
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

## Livré — v1.15 (téléchargeur YouTube/Spotify) ✅
Backend Rust (`downloader.rs` + `download_job.rs`, 15 tests) :
- [x] `download_capabilities` / `download_probe` (async + spawn_blocking) — yt-dlp `-J` : détection single vs playlist (`_type`/`entries`), formats détaillés, sous-titres ; Spotify via `spotdl save`. Parsers purs testés sur fixtures.
- [x] `DownloadManager` + `download_start` (job background, parse `%` stdout yt-dlp `--newline`, emit `download-progress`, cancel via `AtomicBool`) + `download_cancel`. spotdl = progression indéterminée (0→100).
- [x] Résolution binaire venv-first `~/.local/share/vela/dl-venv` puis PATH (modèle `demucs_executable`).
Frontend :
- [x] `services/download.ts` + types, `DownloadModal` + `download-ui.tsx` + hook `use-download.ts`
- [x] URL → sonde → playlist **lazy >10 + scroll** + **select all/none/individuel** ; format/qualité/langue/sous-titres ; destination cwd modifiable + case **nouveau dossier** ; **batch** (1 job/entrée) + progression + cancel
- [x] Déclencheur Sidebar « Système → Télécharger… »
- [x] install.sh : yt-dlp + spotdl auto dans `dl-venv` (yt-dlp non optionnel = core)
- [x] Fix : `download_probe`/`capabilities` async (anti-freeze UI au sondage) · select dark (`appearance-none` + chevron, fix chrome natif WebKitGTK) · barre indéterminée animée pour spotdl

## Livré — v1.16 (profils + layout dynamique) ✅
Architecture **Option A** (profils first-class, `mode` files|edit supprimé). Non-régression : seeds « Explorateur » = ancien files, « Édition » = ancien edit.
- [x] Backend `profiles.rs` (load/save → `~/.config/vela/profiles.json`, modèle favorites.rs) + types PanelId/Zones/Profile/ProfilesState + seed défaut
- [x] `useProfiles` (actif résolu, CRUD, persistance debounce) + `services/profiles.ts`
- [x] `useFileManager` : `mode` retiré → `editorActive` ; `App.tsx` piloté par zones via `ZoneLayout.tsx`
- [x] `Topbar` : sélecteur de profil + bouton éditeur (remplace le toggle mode)
- [x] `FileTree.tsx` : arborescence pliable lazy (réutilise listDir filtré dossiers, cache par path)
- [x] Terminal existant branché comme panneau de zone (sinon dock legacy Ctrl+`)
- [x] `ProfileEditor.tsx` : créer/dupliquer/renommer/supprimer + assigner panneau→zone + toggle barre filtres
- [x] Extractions DialogHost + ResizeHandle (App.tsx < 500 lignes)
- [x] Validé : tsc + cargo + `bun tauri build` + smoke-test binaire

## Livré — v1.17 (navigateur intégré) ✅
Navigateur web multi-onglets dans la zone centrale (bouton Globe), vrai moteur WebKit, navigation libre.
- [x] Backend `browser.rs` (Linux) : webviews wry `build_gtk` dans `gtk::Fixed` + `gtk::Overlay` → contourne bug Tauri #10420 (géométrie ignorée par add_child sur WebKitGTK)
- [x] Commandes **synchrones** (main thread, état thread_local) — pas d'async, pas de marshalling
- [x] Crash vidéo résolu : `HardwareAccelerationPolicy::Never` par-webview (compositing GPU/DMABUF) — UI principale reste accélérée
- [x] Persistance cookies/sessions : `wry::WebContext` sur `app_data_dir()/browser` partagé par les onglets
- [x] `browser_reset` + bouton « Réinitialiser le navigateur » dans SettingsPanel
- [x] Front : `useBrowser` + `BrowserView` (useNativeSync mesure les bounds) + `services/browser.ts` + Globe dans Topbar (bouton « nouveau dossier » retiré)
- [x] Refacto `TerminalDock.tsx` extrait d'App.tsx
- [x] Validé à chaud : positionnement OK, vidéo YouTube OK, persistance + reset confirmés par Chris

## Backlog
- [ ] Édition image en plein écran (remonter le HUD dans le conteneur fullscreen du lecteur pour préserver l'immersion)
- [ ] `App.tsx` à 500 lignes (limite dure atteinte) : découpe obligatoire avant toute nouvelle feature → **chantier 0 de la Roadmap v2 ci-dessous**

---

# ROADMAP v2 — « Effet waouh » : palette + intelligence contextuelle

**✅ LIVRÉ v2.0** (les 8 chantiers ci-dessous) — 47 tests Rust + tests bun (fuzzy, smart-actions) verts,
build deb+rpm, installé (`vela-bin`, sha256 vérifié), palette validée à l'écran. Spécifications conservées
ci-dessous comme référence d'implémentation.

**Thèse** : inverser le paradigme. Aujourd'hui l'utilisateur cherche l'outil ; demain il exprime une
intention (**taper** ou **sélectionner**) et Vela propose + exécute. Pas une feature de plus enterrée
dans un menu — un point d'entrée unique (palette) + des actions qui apparaissent quand elles sont
pertinentes + des capacités locales (conversion, OCR, git, recherche globale, LLM local). 8 chantiers.

## Contraintes transverses — à respecter sur TOUS les chantiers (ne rien casser)

- **App.tsx est à 500/500 lignes (limite dure atteinte).** Aucune feature ne s'y greffe directement.
  Prérequis = refacto (chantier 0). Toute extension d'App.tsx passe par un host extrait.
- **Limites code** (rappel norme) : fichier ≤500, fonction ≤35, ligne ≤120 ; zéro `any` ; return types
  explicites sur fonctions publiques ; try/catch + log (`eprintln!` Rust / `console.error` TS) sur tout
  I/O (FS, process, réseau local).
- **Souveraineté** : zéro réseau au runtime (sauf chantier 7 = LLM 100% local). Binaires externes
  optionnels, détectés via le pattern `media_capabilities`, **dégradation gracieuse** (jamais de crash
  ni de blocage si absent — message « non installé » + aide).
- **WebKitGTK quirks** (déjà documentés, à respecter) : `<select>` natif cassé → `appearance-none` +
  chevron custom. Autofocus d'un input = `ref` + `requestAnimationFrame` (le focus immédiat échoue
  parfois sous WebKitGTK). Navigation clavier globale = capture phase + `e.code` (jamais `e.key` seul).
  Pas d'API navigateur récente non supportée par WebKitGTK 2.x. `navigator.clipboard.writeText` OK
  (déjà utilisé dans ContextMenu).
- **E2E** : `invoke` ne tourne QUE dans le webview WebKitGTK → **non pilotable par Playwright** (Chromium).
  Validation = `cargo check` + `cargo test` + `bun tauri build` (deb+rpm) + install + `grim` screenshot
  + test interactif Chris. Les helpers purs (fuzzy, routage formats, smart-actions) → `bun test`.
- **Rituel install** : `pkill -x vela-bin` (**JAMAIS `-f`** — tue le shell avant le cp), `cp` →
  `~/.local/bin/vela-bin`, vérif sha256. Lancement via wrapper `~/.local/bin/vela`
  (`WEBKIT_DISABLE_DMABUF_RENDERER=1`). Géré par `./install.sh`.
- **Checkpoint git** `[CHECKPOINT]` après chaque chantier passé au vert. Commit final par chantier.
- **Enregistrement commandes Rust** : 80 actuellement. Nouveau module = `mod X;` dans `lib.rs` +
  entrées dans `invoke_handler` + `.manage(...)` si état partagé. Mettre à jour le compteur dans
  STATE.md + ARBORESCENCE.md à chaque chantier.
- **ARBORESCENCE.md** : ajouter chaque fichier créé au fil de l'eau (documente le réel, pas le prévu).

## Ordre d'implémentation (dépendances)

0. Refacto App.tsx (prérequis dur)
1. Palette `Ctrl+K` (multiplicateur — rend tout le reste découvrable)
2. Conversion universelle (effet waouh le plus large, brique réutilisée par 3)
3. Actions contextuelles intelligentes (réutilise conversion + OCR)
4. Git natif visuel
5. Recherche globale indexée (alimente la palette pour les fichiers hors cwd)
6. OCR / extraction de texte
7. Langage naturel local via EchoHub (optionnel, opt-in strict — dernier)

---

## ✅ Chantier 0 — Refacto App.tsx (prérequis, non-régression totale)

**Objectif** : libérer App.tsx (500/500) et créer les ancrages pour la palette + le registre d'actions.

**Plan**
- `src/components/OverlayHost.tsx` (nouveau) : extraire le bloc des overlays conditionnels de fin
  d'App.tsx (Settings, ProfileEditor, Download, Diff, DirCompare, DiskAnalyzer, + futur CommandPalette).
  Reçoit un objet `overlays` (états booléens + handlers `onClose` déjà présents dans App). Calqué sur
  `DialogHost`. Déplacement pur, zéro changement de logique.
- Si encore trop long : extraire le listener Ctrl+` et les blocs de props (`terminalProps`,
  `profileEditorProps`) déjà regroupés.

**Points de vigilance** : non-régression absolue — chaque overlay doit s'ouvrir/fermer exactement
comme avant. Tester manuellement chaque modale après extraction. Ne pas toucher à la logique métier.

**Fichiers** : `App.tsx`, `OverlayHost.tsx` (nouveau).
**Validation** : `tsc` + `bun tauri build` + ouvrir chaque overlay à la main. Checkpoint git.

---

## ✅ Chantier 1 — Palette de commandes `Ctrl+K`

**Objectif** : barre unique centrale, fuzzy match **simultané** sur fichiers (cwd, puis global via
chantier 5), actions (toutes les commandes existantes), emplacements/favoris. Zéro courbe d'apprentissage.

**Frontend**
- `src/lib/fuzzy.ts` (nouveau) : matcher fuzzy **pur, sans dépendance** (score subséquence + bonus
  début-de-mot + bonus séparateur/camel), ~40 lignes, testable. **Ne pas ajouter fuse.js/fzf** (souv. + simplicité).
- `src/hooks/useCommandRegistry.ts` (nouveau) : prend un objet `ctx` (handlers existants d'App :
  `openTerminalHere`, `setSettingsOpen`, `setDownloadOpen`, `browser.open`, `compareSelection`,
  `fm.refresh`, `fm.toggleHidden`, profils, etc.) → retourne `Command[]`
  (`{ id, title, hint?, group, run, when? }`). **Source unique de vérité** : la palette lit ce registre,
  pas de duplication des actions.
- `src/components/CommandPalette.tsx` (nouveau) : overlay centré, input **autofocus (ref + rAF)**,
  liste filtrée groupée (Fichiers / Actions / Lieux), navigation ↑↓/Entrée/Échap. Fichier → openEntry /
  navigate ; action → `run()`.
- `src/hooks/useCommandPalette.ts` (nouveau) : état `open` + ouverture.
- `src/hooks/useKeyboard.ts` : ajouter `onPalette?` géré **AVANT** le guard `inEditable` (comme
  `Escape`) sur `mod && e.key === "k"` (la palette doit s'ouvrir même depuis l'éditeur). `e.preventDefault()`.

**Points de vigilance** : autofocus WebKitGTK (rAF obligatoire). Perf matcher < 16 ms sur ~1000 entrées.
Le registre doit refléter les **vraies** actions (généré depuis les handlers, jamais réécrit en dur).
Branchement via `OverlayHost` (pas dans App.tsx directement).

**Fichiers** : `fuzzy.ts`, `useCommandRegistry.ts`, `CommandPalette.tsx`, `useCommandPalette.ts`
(nouveaux), `useKeyboard.ts`, `OverlayHost.tsx`.
**Validation** : `bun test` fuzzy ; manuel : Ctrl+K → taper un fichier (ouvre), taper « terminal »
(action), ouvrir depuis l'éditeur. Checkpoint git.

---

## ✅ Chantier 2 — Conversion universelle

**Objectif** : « Convertir vers… » partout (clic droit, palette, drag&drop). 100 % local.

**Stack / matrice / souveraineté**
- **Images** : crate `image` (**DÉJÀ présente**) — png/jpg/webp/gif/bmp/tiff/ico. Zéro dep ajoutée.
- **Images → PDF** : crate `printpdf` (**pure Rust, souverain**) — pas de bin externe. Nouvelle dep Cargo.
- **Documents** : `pandoc` (md/html/docx/odt/epub/rst/latex) + `libreoffice --headless --convert-to`
  (office → pdf/docx). **Binaires externes optionnels.**
- **Audio/vidéo** : `ffmpeg` (**DÉJÀ utilisé**) — déléguer aux commandes `audio_convert`/`video_convert`
  existantes quand le couple source→cible le permet.

**Backend** : `src-tauri/src/convert.rs` (nouveau)
- `convert_capabilities() -> ConvertCapabilities { pandoc, libreoffice }` (pattern `media_capabilities`
  + `binary_exists`).
- `convert_targets(path) -> Vec<String>` : formats cibles selon le type source (table de routage pure, testable).
- `convert_file(input, target, output?) -> Result<String>` : dispatch image / doc / pdf. Jobs longs
  (libreoffice) en background + event progress si nécessaire (réutiliser le pattern `video::video_convert`).
  try/catch + log. **Ne jamais écraser la source** (suffixe ou dossier de sortie).

**Frontend** : `src/services/convert.ts` (nouveau) + `useCapabilities` (calqué `use-download`) ;
sous-menu « Convertir vers › <formats> » dans `ContextMenu` (formats issus de `convert_targets`) ;
entrée registre palette.

**Points de vigilance** : pandoc/libreoffice = paquets **système** (pacman), PAS pip → `install.sh`
propose la ligne `pacman -S` (sans `sudo` auto), détection gracieuse « non installé ». libreoffice
headless lent au 1er lancement (création de profil) → job background + feedback. printpdf augmente le
temps de build (acceptable).

**Fichiers** : `convert.rs` (nouveau), `lib.rs`, `Cargo.toml` (`printpdf`), `services/convert.ts`
(nouveau), `ContextMenu.tsx`, `useCommandRegistry.ts`, `install.sh`.
**Validation** : `cargo test` (routage formats sur fixtures) ; png→jpg, md→pdf (si pandoc), docx→pdf
(si libreoffice) ; binaire absent → message propre. Checkpoint git.

---

## ✅ Chantier 3 — Actions contextuelles intelligentes

**Objectif** : `ContextMenu` réactif au **type collectif** de la sélection ; bonnes actions en tête.

**Frontend**
- `src/services/smart-actions.ts` (nouveau) : `smartActions(entries: DirEntry[]): SmartAction[]` —
  **pur, testable**. Règles : toutes images → « Créer un PDF », « Tout redimensionner »,
  « Convertir en JPG », « Planche contact » ; tous CSV → « Fusionner » ; tous audio/vidéo → outils
  média par lot ; 2 fichiers → « Comparer » (déjà géré, le centraliser) ; dossier → « Ranger par
  type / par date ».
- `ContextMenu.tsx` : recevoir `entries: DirEntry[]` (**la sélection résolue**, pas seulement le clic
  actuel) ; afficher une section « Actions » en tête depuis `smartActions`. Si la section grossit,
  l'extraire (`ContextMenu` doit rester < 500 lignes).
- `App.tsx`/`OverlayHost` : passer la sélection résolue (`entries.filter(e => selection.has(e.path))`)
  au ContextMenu.

**Backends utilitaires**
- « Créer un PDF » → `printpdf` (chantier 2).
- « Fusionner CSV » → `merge_csv(paths, output)` dans `convert.rs` ou `fs_ops.rs`.
- « Ranger par type/date » → `organize_dir(path, by)` (déplace dans des sous-dossiers). **ANNULABLE** :
  brancher `useUndo` (op move inverse) + **confirmation** avant exécution.

**Points de vigilance** : « Ranger » déplace des fichiers → réversible (useUndo) + confirmation
obligatoire. N'afficher une action que si ses outils sont disponibles (`when` ← capabilities).

**Fichiers** : `smart-actions.ts` (nouveau), `ContextMenu.tsx`, `App.tsx`, `convert.rs`/`ops.rs`,
`lib.rs`, `useUndo.ts`.
**Validation** : `bun test` smartActions ; 5 images → « Créer un PDF » ; ranger un dossier → Ctrl+Z
restaure. Checkpoint git.

---

## ✅ Chantier 4 — Git natif visuel

**Stack / souveraineté** : crate `git2` (libgit2, build **vendored**, offline). Pas de process `git` externe.

**Backend** : `src-tauri/src/git.rs` (nouveau) — stateless (cache léger optionnel)
- `git_repo_root(path) -> Option<String>`
- `git_status(root) -> Vec<GitFileStatus { path, status }>` (`StatusOptions` : `include_untracked`,
  **pas** de `recurse_untracked_dirs` sur gros repo). `spawn_blocking`.
- `git_current_branch`, `git_branches`, `git_log(n)`, `git_stage(paths)`, `git_unstage(paths)`,
  `git_commit(msg)`, `git_checkout_branch`, `git_diff_file(path) -> { old, new }` (HEAD blob vs worktree).

**Frontend**
- `src/hooks/useGitStatus.ts` (nouveau) : résout le repo du cwd, mappe `path → status`, refresh sur
  event `fs-changed` (watcher **existant**) + debounce.
- Badges dans `FileTile.tsx` / `FileTable.tsx` (pastille couleur : modifié / ajouté / non-suivi / ignoré).
- `src/components/GitPanel.tsx` (nouveau) : **nouveau `PanelId` `"git"`** intégré au système de
  zones/profils (comme terminal/filetree) → status, stage/unstage, message + commit, branches, log.
  Diff fichier réutilise `DiffViewer` (mode contenu-vs-contenu, blob HEAD vs worktree, sans fichier temp).
- `profiles.rs` / `types.ts` : ajouter `"git"` à `PanelId` ; `ProfileEditor` le propose ; `ZoneLayout`
  le rend.

**Points de vigilance** : perf `git_status` sur gros repo → `StatusOptions` restrictives + cache +
debounce + `spawn_blocking` (jamais bloquer l'UI). Hors repo → panneau « pas un dépôt git » (pas
d'erreur). `git2` vendored = temps de build +. `DiffViewer` attend 2 fichiers → l'adapter pour
recevoir du **contenu brut** (blob HEAD) sans écrire de fichier temporaire.

**Fichiers** : `git.rs` (nouveau), `lib.rs`, `Cargo.toml` (`git2`), `useGitStatus.ts` (nouveau),
`GitPanel.tsx` (nouveau), `FileTile.tsx`, `FileTable.tsx`, `profiles.rs`, `types.ts`, `ZoneLayout.tsx`,
`ProfileEditor.tsx`, `DiffViewer.tsx`.
**Validation** : `cargo test` (status sur repo fixture temporaire init+commit) ; ouvrir Vela dans un
repo → badges + commit depuis le panneau ; dossier non-git → message propre. Checkpoint git.

---

## ✅ Chantier 5 — Recherche globale indexée

**Objectif** : recherche système **instantanée** par nom, branchée dans la palette + la barre de
recherche (mode « global »). Contenu à la demande = `search_content` existant.

**Stack / souveraineté** : index **en mémoire** (zéro dep — pas de SQLite/tantivy au début).
Persistance cache disque optionnelle pour démarrage rapide.

**Backend** : `src-tauri/src/index.rs` (nouveau)
- `.manage(SearchIndex)` : `RwLock<Vec<IndexedEntry { path, name_lc }>>`. Construit en **background
  thread** par `walkdir` des racines (HOME + montages), `hidden`/`.git`/`node_modules`/`target` exclus.
- `global_search(query, limit) -> Vec<DirEntry>` : filtre subséquence/substring + tri par score.
- `index_refresh()` : reconstruction. Incrémental via watcher = option v2.

**Frontend** : `src/services/search-index.ts` (nouveau) ; mode « global » dans `useSearch` ; fichiers
hors cwd dans la palette (chantier 1).

**Points de vigilance** : 1er build peut prendre quelques secondes sur gros HOME → background + état
« indexation… » **non bloquant**. Mémoire : stocker uniquement `path` + `name_lc`. Exclure dossiers
lourds. Respecter `hidden`. Pas de scan de montages réseau distants.

**Fichiers** : `index.rs` (nouveau), `lib.rs`, `services/search-index.ts` (nouveau), `useSearch.ts`,
`CommandPalette.tsx`.
**Validation** : `cargo test` (filtre sur index fixture) ; palette → nom de fichier hors cwd → trouvé.
Checkpoint git.

---

## ✅ Chantier 6 — OCR / extraction de texte

**Stack / souveraineté** : `tesseract` (binaire) + données langue (`tesseract-data-fra`/`-eng`).
Optionnel, détecté.

**Backend** : `src-tauri/src/ocr.rs` (nouveau)
- `ocr_capabilities() -> { tesseract: bool, langs: Vec<String> }` (pattern capabilities).
- `ocr_extract(path, lang) -> Result<String>` : image directe via tesseract. PDF scanné → rasteriser
  les pages (`pdftoppm` si dispo) puis tesseract (dépendances en cascade, toutes optionnelles).

**Frontend** : `src/services/ocr.ts` (nouveau) ; clic droit image/PDF → « Extraire le texte » →
résultat dans un nouveau buffer éditeur (ou copié) ; entrée registre palette + `smart-actions`.

**Points de vigilance** : tesseract absent → message + ligne `pacman`. Langue défaut `fra+eng`,
configurable (Réglages). try/catch + log.

**Fichiers** : `ocr.rs` (nouveau), `lib.rs`, `services/ocr.ts` (nouveau), `ContextMenu.tsx`,
`smart-actions.ts`, `useCommandRegistry.ts`, `install.sh`.
**Validation** : `cargo test` (skip si tesseract absent, comme media) ; OCR image de texte → texte
correct. Checkpoint git.

---

## ✅ Chantier 7 — Langage naturel local via EchoHub (optionnel, opt-in strict)

**Objectif** : la palette comprend l'intention en langage naturel via LLM **100 % local**
(EchoHub `http://127.0.0.1:37821`, API Anthropic Messages). **DÉSACTIVÉ par défaut.**

**Stack / souveraineté** : endpoint local uniquement. Endpoint absent → feature **invisible**, zéro impact.

**Backend / logique** : `src/services/nl.ts` (ou `nl.rs`) — `nlResolve(prompt, context) -> Action[]` :
appelle le LLM local avec, comme schéma d'outils, le **registre d'actions** (function calling /
structured output), retourne les actions à exécuter.

**Frontend** : toggle Réglages « Palette intelligente (LLM local) » + champ endpoint. Dans la palette,
si activé et la saisie n'est pas un match direct → bouton « interpréter ».

**Points de vigilance** : **opt-in strict**. Toute action destructive (suppr, déplacement massif) passe
par **confirmation**. Timeout court + fallback silencieux si LLM lent/absent. Le LLM ne reçoit que le
registre + la sélection courante (jamais de contenu fichier sans consentement).

**Fichiers** : `services/nl.ts` (nouveau), `SettingsPanel.tsx`, `CommandPalette.tsx`,
`useCommandRegistry.ts`.
**Validation** : EchoHub chargé → « range mes images » déclenche `organize` (avec confirmation) ;
EchoHub absent → feature masquée. Checkpoint git.

