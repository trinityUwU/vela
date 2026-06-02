# ARBORESCENCE — Vela

```
vela/
├── index.html
├── package.json
├── vite.config.ts                  Vite (React + Tailwind, port 1430, HMR 1431)
├── tsconfig.json / tsconfig.node.json
├── start.sh / stop.sh / restart.sh   (dev) · install.sh (build release + install vela-bin, pkill -x)
├── README.md / STATE.md / TODO.md / ARBORESCENCE.md
├── .env.example
│
├── src/
│   ├── main.tsx                    Bootstrap React + styles
│   ├── App.tsx                     Layout + modals (menu, rename, delete, props, newfile, newfolder)
│   ├── styles.css                  Tailwind + tokens CSS + CodeMirror dark + prose markdown
│   ├── types.ts                    DirEntry, DirListing, FileChunk, Place, Mode,
│   │                               Favorites, FavPin, FavGroup, ArchiveEntry,
│   │                               EntryProps, AppInfo (+exec +source), FileApps,
│   │                               ExtractionStatus, ExtractionJob, Clipboard, ContentMatch
│   │
│   ├── services/
│   │   ├── fs.ts                   Wrappers invoke() → toutes commandes Rust + startExtraction,
│   │   │                           trash/delete/copy/moveEntries, createArchive, searchContent, watchDir
│   │   ├── file-kind.ts            Preview type (code/md/image/table/archive/binary)
│   │   │                           + isEditable + langExtension (CodeMirror)
│   │   └── tags.ts                 Palette couleur (7 clés→hex) + load_tags/set_tag wrappers
│   │
│   ├── hooks/
│   │   ├── useFileManager.ts       État central : nav, mode, sélection multiple (Set + anchor),
│   │   │                           presse-papier, CRUD, ops groupées (trash/delete/copy/compress),
│   │   │                           renameMany, watch live (fs-changed), persistance session
│   │   ├── useFileContent.ts       Chargement fichier : édition (≤1Mo) / chunks (>1Mo) / skip
│   │   ├── useFavorites.ts         Pins + groupes, persistance auto via save_favorites
│   │   ├── useSearch.ts            Recherche live (debounce 500ms) : mode Nom / Contenu
│   │   ├── useSort.ts              Tri (name/size/modified/extension, ASC/DESC) + filtre
│   │   │                           (all/files/dirs) + dirsFirst — persisté localStorage
│   │   ├── useKeyboard.ts          Raccourcis globaux (C/X/V/A/F/Z, F2/F5, Suppr, Espace, Échap,
│   │   │                           flèches+Entrée navigation, Alt+←/→ historique)
│   │   ├── useUndo.ts              Pile Ctrl+Z (rename/move/copy/trash) — ops inverses, max 30
│   │   ├── useEditorTabs.ts        Onglets multi-fichiers mode Édition (sync sur fm.opened)
│   │   ├── useTags.ts              Étiquettes couleur : chargement + application optimiste
│   │   ├── useExtractions.ts       Écoute events Tauri extraction-progress → Map<id, ExtractionJob>
│   │   │                           auto-dismiss 6s états terminaux
│   │   ├── useTransfers.ts         Écoute transfer-progress → Map<id, TransferJob> (copie/déplacement)
│   │   ├── useThumbnail.ts         Miniature lazy (IntersectionObserver) + file concurrence globale 4
│   │   └── useTerminals.ts         Onglets terminal : open/close PTY, onglet actif, rename + color (mémoire)
│   │
│   └── components/
│       ├── Topbar.tsx              Toggle modes, PathBar éditable, search (Nom/Contenu), drop crumbs
│       ├── Sidebar.tsx             Favoris/groupes + Emplacements + Montages + Corbeille (badge, vider)
│       ├── SortBar.tsx             Barre tri/filtre compacte (32px) sous topbar
│       ├── FileGrid.tsx            Grille mode Fichiers, sélection multiple, clic fond = clear
│       ├── FileTable.tsx           Vue liste détaillée mode Fichiers : colonnes Nom/Taille/Date/Type, tri en-tête
│       ├── FileList.tsx            Liste pane gauche mode Édition, sélection + élément actif
│       ├── FileTile.tsx            Tuile grille : drag source + drop target dossiers
│       ├── FileIcon.tsx            Icônes devicon (20+ langages) + SVG génériques
│       ├── Editor.tsx              CodeMirror + save + search + MD preview + image + archive + table (prop active)
│       ├── EditorArea.tsx          Mode Édition multi-onglets : barre + un Editor monté par fichier
│       ├── SettingsPanel.tsx       Overlay Réglages : référence des features + raccourcis <kbd>
│       ├── DiffViewer.tsx          Comparaison 2 fichiers (CodeMirror MergeView, lecture seule)
│       ├── TableViewer.tsx         CSV/TSV (auto-sep) + XLSX/XLS/ODS (SheetJS), filtre live
│       ├── ArchiveViewer.tsx       Liste archive + extraction non-bloquante (ici / chemin custom)
│       ├── ExtractionPanel.tsx     Panel fixe bas-droite : extractions + transferts empilés, progression,
│       │                           pause/reprise/annulation, mot de passe inline, aller au dossier
│       ├── PdfViewer.tsx           Aperçu PDF (pdf.js worker local) : canvas/page, zoom, lazy >20 pages
│       ├── TerminalPanel.tsx       Panneau terminal bas : onglets (clic droit → renommer + pastille) + xterm.js par PTY
│       ├── PropertiesModal.tsx     Métadonnées + contenu dossier + app par défaut (PATH + custom)
│       ├── ContextMenu.tsx         Mono/multi : ouvrir, extraire, copier/couper, compresser,
│       │                           renommer (mono) / par lot (multi), corbeille, suppr définitive
│       ├── BgContextMenu.tsx       Clic droit zone vide : nouveau fichier/dossier, coller, actualiser,
│       │                           toggle hidden, épingler, propriétés dossier
│       ├── CompressModal.tsx       Création archive : nom + format ZIP / TAR.GZ
│       ├── BatchRenameModal.tsx    Renommage par lot : rechercher/remplacer + {n}, aperçu live
│       ├── QuickLook.tsx           Overlay aperçu rapide (Espace) réutilisant l'éditeur
│       ├── SearchBar.tsx           SearchInput (toggle Nom/Contenu) + SearchResults (overlay)
│       ├── InputModal.tsx          Modal saisie texte (renommer, nouveau dossier, nouveau fichier)
│       ├── ConfirmModal.tsx        Confirmation suppression
│       └── icons.tsx               SVG inline (ArrowUp, Refresh, Eye, Search, Save…)
│
└── src-tauri/
    ├── Cargo.toml                  zip, tar, flate2, bzip2, xz2, base64, mime_guess, trash, walkdir, notify, image
    ├── tauri.conf.json             1200×780, decorations:false, devUrl:1430, targets:deb+rpm
    ├── capabilities/default.json   core:default, start-dragging, opener:default + allow-open-path
    └── src/
        ├── main.rs
        ├── lib.rs                  Builder + manage(Extraction/DirWatcher/Transfer/Terminal Manager) + 47 commandes
        ├── fs_ops.rs               CRUD + chunks + search + move + props + open_native + createFile
        ├── ops.rs                  trash/delete/copy/move groupés (copy retourne chemins créés),
        │                           transfer_pause/resume/cancel, create_archive, search_content,
        │                           trash_dir/trash_count/empty_trash/restore_trash (corbeille XDG)
        ├── watcher.rs              DirWatcher (state) + watch_dir (notify → event fs-changed)
        ├── terminal.rs             TerminalManager (PTY portable-pty) : term_open/input/resize/close
        ├── thumbs.rs               thumbnail (crate image, PNG base64, cache ~/.cache/vela/thumbs)
        ├── places.rs               home_dir, list_places (XDG + mounts)
        ├── favorites.rs            load/save favorites (JSON ~/.config/vela/)
        ├── tags.rs                 load_tags/set_tag — étiquettes couleur (~/.config/vela/tags.json)
        ├── archive.rs              list_archive, ExtractionManager (Tauri state), start_extraction,
        │                           extraction_pause/resume/cancel/provide_password — ZIP natif
        │                           (AtomicBool pause, by_index_decrypt password), TAR natif,
        │                           7z/RAR process (SIGSTOP/SIGCONT, stdout -bsp1, retry password)
        └── apps.rs                 get_apps_for_file, search_path_bins, set_default_app,
                                    set_custom_command (crée .desktop vela-custom/auto-*)
```
