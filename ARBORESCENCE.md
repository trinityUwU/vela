# ARBORESCENCE — Vela

```
vela/
├── index.html
├── package.json
├── vite.config.ts                  Vite (React + Tailwind, port 1430, HMR 1431)
├── tsconfig.json / tsconfig.node.json
├── start.sh / stop.sh / restart.sh
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
│   │                               ExtractionStatus, ExtractionJob
│   │
│   ├── services/
│   │   ├── fs.ts                   Wrappers invoke() → toutes commandes Rust + startExtraction,
│   │   │                           extractionPause/Resume/Cancel/ProvidePassword, searchPathBins
│   │   └── file-kind.ts            Preview type (code/md/image/table/archive/binary)
│   │                               + isEditable + langExtension (CodeMirror)
│   │
│   ├── hooks/
│   │   ├── useFileManager.ts       État central : nav, mode, sélection, CRUD, moveEntry, createFile
│   │   ├── useFileContent.ts       Chargement fichier : édition (≤1Mo) / chunks (>1Mo) / skip
│   │   ├── useFavorites.ts         Pins + groupes, persistance auto via save_favorites
│   │   ├── useSearch.ts            Recherche live (debounce 500ms, min 2 chars)
│   │   ├── useSort.ts              Tri (name/size/modified/extension, ASC/DESC) + filtre
│   │   │                           (all/files/dirs) + dirsFirst — persisté localStorage
│   │   └── useExtractions.ts       Écoute events Tauri extraction-progress → Map<id, ExtractionJob>
│   │                               auto-dismiss 6s états terminaux
│   │
│   └── components/
│       ├── Topbar.tsx              Toggle modes, PathBar éditable, search, drop crumbs
│       ├── Sidebar.tsx             Favoris/groupes (collapse) + Emplacements + Montages, drop targets
│       ├── SortBar.tsx             Barre tri/filtre compacte (32px) sous topbar
│       ├── FileGrid.tsx            Grille mode Fichiers, drag & drop, onContextBg
│       ├── FileList.tsx            Liste pane gauche mode Édition, drag & drop, onContextBg
│       ├── FileTile.tsx            Tuile grille : drag source + drop target dossiers
│       ├── FileIcon.tsx            Icônes devicon (20+ langages) + SVG génériques
│       ├── Editor.tsx              CodeMirror + save + search + MD preview + image + archive + table
│       ├── TableViewer.tsx         CSV/TSV (auto-sep) + XLSX/XLS/ODS (SheetJS), filtre live
│       ├── ArchiveViewer.tsx       Liste archive + extraction non-bloquante (ici / chemin custom)
│       ├── ExtractionPanel.tsx     Panel fixe bas-droite : jobs empilés, progression, pause/reprise/
│       │                           annulation, mot de passe inline, aller au dossier
│       ├── PropertiesModal.tsx     Métadonnées + contenu dossier + app par défaut (PATH + custom)
│       ├── ContextMenu.tsx         Ouvrir / Extraire ici + vers… (archives) / Copier chemin /
│       │                           Copier chemin relatif / Renommer / Supprimer / Propriétés
│       ├── BgContextMenu.tsx       Clic droit zone vide : nouveau fichier/dossier, actualiser,
│       │                           toggle hidden, épingler, propriétés dossier
│       ├── SearchBar.tsx           SearchInput (topbar) + SearchResults (overlay)
│       ├── InputModal.tsx          Modal saisie texte (renommer, nouveau dossier, nouveau fichier)
│       ├── ConfirmModal.tsx        Confirmation suppression
│       └── icons.tsx               SVG inline (ArrowUp, Refresh, Eye, Search, Save…)
│
└── src-tauri/
    ├── Cargo.toml                  zip, tar, flate2, bzip2, xz2, base64, mime_guess
    ├── tauri.conf.json             1200×780, decorations:false, devUrl:1430, targets:deb+rpm
    ├── capabilities/default.json   core:default, start-dragging, opener:default + allow-open-path
    └── src/
        ├── main.rs
        ├── lib.rs                  Builder + manage(ExtractionManager) + enregistrement 27 commandes
        ├── fs_ops.rs               CRUD + chunks + search + move + props + open_native + createFile
        ├── places.rs               home_dir, list_places (XDG + mounts)
        ├── favorites.rs            load/save favorites (JSON ~/.config/vela/)
        ├── archive.rs              list_archive, ExtractionManager (Tauri state), start_extraction,
        │                           extraction_pause/resume/cancel/provide_password — ZIP natif
        │                           (AtomicBool pause, by_index_decrypt password), TAR natif,
        │                           7z/RAR process (SIGSTOP/SIGCONT, stdout -bsp1, retry password)
        └── apps.rs                 get_apps_for_file, search_path_bins, set_default_app,
                                    set_custom_command (crée .desktop vela-custom/auto-*)
```
