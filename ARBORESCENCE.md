# ARBORESCENCE — Vela

```
vela/
├── index.html
├── package.json
├── vite.config.ts                  Vite (React + Tailwind, port 1430)
├── tsconfig.json / tsconfig.node.json
├── start.sh / stop.sh / restart.sh
├── README.md / STATE.md / TODO.md / ARBORESCENCE.md
├── .env.example
│
├── src/
│   ├── main.tsx                    Bootstrap React + styles
│   ├── App.tsx                     Assemblage layout + modals
│   ├── styles.css                  Tailwind + tokens + CodeMirror + prose markdown
│   ├── types.ts                    DirEntry, DirListing, FileChunk, Place, Mode
│   │
│   ├── services/
│   │   ├── fs.ts                   Wrappers invoke() → commandes Rust
│   │   └── file-kind.ts            Classification extension → langage CodeMirror + type preview
│   │
│   ├── hooks/
│   │   ├── useFileManager.ts       État central : navigation, mode, sélection, CRUD
│   │   └── useFileContent.ts       Chargement fichier : édition (≤1Mo) ou chunks (>1Mo)
│   │
│   └── components/
│       ├── Topbar.tsx              Toggle modes + PathBar éditable + actions
│       ├── Sidebar.tsx             Emplacements (home/XDG/montages)
│       ├── FileGrid.tsx            Grille mode Fichiers
│       ├── FileList.tsx            Liste compacte pane gauche mode Édition
│       ├── FileTile.tsx            Tuile grille
│       ├── FileIcon.tsx            Icône par format (devicon + SVG génériques)
│       ├── Editor.tsx              CodeMirror + save + aperçu md + bandeau gros fichiers
│       ├── ContextMenu.tsx         Clic droit (ouvrir/renommer/supprimer)
│       ├── InputModal.tsx          Modal saisie + Backdrop + Btn réutilisables
│       ├── ConfirmModal.tsx        Confirmation suppression
│       └── icons.tsx               Icônes SVG inline (navigation/actions)
│
└── src-tauri/
    ├── Cargo.toml
    ├── tauri.conf.json             Fenêtre 1200×780, decorations:false, devUrl:1430
    ├── capabilities/default.json   Permissions (core:default, start-dragging, opener)
    └── src/
        ├── main.rs
        ├── lib.rs                  Builder + enregistrement commandes
        ├── fs_ops.rs               list_dir, read/write_file, read_file_chunk, rename, delete, create_dir
        └── places.rs               home_dir, list_places
```
