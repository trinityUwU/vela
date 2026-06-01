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

# À FAIRE — specs détaillées (chantier v1.5)

> Ordre d'attaque recommandé : (1) progression copie → (2) PDF → (3) thumbnails.
> Chaque feature ci-dessous est auto-suffisante : tout le contexte d'implémentation est ici.

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

## Backlog (non détaillé — à spécifier au moment venu)
- [ ] Onglets multi-fichiers en mode Édition
- [ ] Diff entre deux fichiers (CodeMirror merge view) — 2 fichiers sélectionnés → clic droit « Comparer »
- [ ] Terminal intégré (cwd courant)
- [ ] Tags / couleurs sur fichiers (métadonnées `~/.config/vela/tags.json`)
- [ ] Annuler (Ctrl+Z) sur rename/move/delete récents (pile d'opérations inverses)
