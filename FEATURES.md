<div align="center">

# Vela

**Le gestionnaire de fichiers Linux qui pense comme un poste de travail.**

Navigation, édition de code, retouche média, navigateur web, git et un agent IA,
dans une seule fenêtre que tu recomposes à la volée. 100 % local, zéro dépendance réseau.

`Tauri v2` · `Rust` · `React 19` · `TypeScript` · `Tailwind v4` · `124 commandes natives`

</div>

---

## En une phrase

Les autres gestionnaires de fichiers délèguent tes fichiers à d'autres applications.
Vela les ouvre chez lui et garde le contrôle du début à la fin.

---

## La différence en un tableau

| | Vela | Nautilus | Nemo | Dolphin | Thunar |
|---|:---:|:---:|:---:|:---:|:---:|
| Layouts recomposables (profils) | ✅ | ❌ | ❌ | ◑ split | ❌ |
| Éditeur de code intégré | ✅ CodeMirror 6 | ❌ | ❌ | ❌ | ❌ |
| Retouche image / audio / vidéo native | ✅ | ❌ | ❌ | ❌ | ❌ |
| Navigateur web intégré | ✅ | ❌ | ❌ | ❌ | ❌ |
| Palette de commandes (`Ctrl+K`) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Git natif + diff inline | ✅ libgit2 | ❌ | ◑ ext. | ◑ plugin | ❌ |
| Téléchargeur YouTube / Spotify | ✅ | ❌ | ❌ | ❌ | ❌ |
| Agent IA pilotant l'UI (Claude Code) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Recherche globale indexée | ✅ | ◑ tracker | ◑ | ✅ baloo | ❌ |
| Empreinte mémoire / démarrage | ◑ WebKit | ✅ natif | ✅ natif | ✅ natif | ✅ natif |
| Multi-plateforme | Linux | Linux | Linux | Linux/Win | Linux |

`✅ natif · ◑ partiel ou via extension · ❌ absent`

Le seul point où Vela cède du terrain est un choix assumé : l'UI est rendue par WebKitGTK,
pas par des widgets GTK natifs en C. C'est le prix de tout le reste de ce tableau.

---

## Ce que Vela fait, concrètement

### 🪟 Profils de layout

Tu composes ta fenêtre. Quatre zones (**gauche / centre / droite / bas**), chacune reçoit
le panneau de ton choix : favoris, listing, éditeur, arborescence, terminal, git.
Tu bascules d'un profil à l'autre depuis la barre du haut.

| Profil fourni | Composition |
|---|---|
| **Explorateur** | Navigation classique (favoris + listing) |
| **Édition** | Listing + éditeur côte à côte |
| **+ les tiens** | Créer, dupliquer, renommer — persisté dans `~/.config/vela/profiles.json` |

### 📁 Navigation & gestion

- Grille ou liste, icônes par format (devicon + SVG génériques), tri configurable persistant
- Sidebar : favoris épinglables et groupés, emplacements XDG, points de montage
- Breadcrumb éditable, recherche live dans le dossier (debounce, async Rust)
- CRUD complet, drag & drop (vers dossiers, crumbs, sidebar), corbeille avec restauration
- Renommage par lot, pastilles de couleur (tags), propriétés détaillées (permissions Unix, taille récursive)
- **Ctrl+clic sur un chemin dans le terminal** → ouvre le fichier / entre dans le dossier

### 📝 Éditeur intégré

- CodeMirror 6 : Python, JS/TS, Rust, HTML, CSS, JSON, Markdown, Go, PHP…
- `Ctrl+S` sauver · `Ctrl+F` chercher · aperçu Markdown rendu · preview image inline
- Multi-onglets avec **clic droit** (renommer, supprimer, copier le chemin, couleur) + pastille de tag
- Gros fichiers (> 1 Mo) lus par chunks de 512 Ko → zéro freeze
- Viewer archives (ZIP, TAR.*, RAR, 7Z) et tableaux (CSV/TSV/XLSX/ODS) avec filtre live

### 🎨 Retouche média, sans quitter Vela

Modèle « ouvre → paramètre → exporte », tout local, non destructif.

| Domaine | Opérations | Moteur |
|---|---|---|
| **Image** | recadrer, pivoter, retourner, redimensionner, ajuster (lum./contr./sat.) — empilées, un seul export | crate `image` |
| **Audio** | découper, fondu, normaliser, convertir, retirer la voix, **séparation de stems** (GPU si CUDA) | ffmpeg + demucs |
| **Vidéo** | découper, convertir/compresser (CRF, job background), extraire image/audio | ffmpeg |

### 🌐 Navigateur web intégré

Un vrai navigateur multi-onglets (WebKit) dans la zone centrale : barre d'adresse,
historique, cookies et sessions conservés entre les lancements, bouton de réinitialisation.

### ⌘ Palette de commandes (`Ctrl+K`)

Une barre, tu tapes l'intention. Elle cherche **en même temps** dans tes fichiers (dossier
courant + index système), tes actions et tes emplacements. Option avancée : interprétation
en langage naturel via un LLM 100 % local (EchoHub), désactivée par défaut.

### 🔀 Conversion & actions intelligentes

- **Convertir vers** : images entre elles et vers PDF (sans rien installer), documents via
  pandoc, bureautique vers PDF via LibreOffice. Outil absent → l'entrée disparaît proprement.
- **Actions contextuelles** : plusieurs images → « Créer un PDF » ; des CSV → « Fusionner » ;
  un dossier en vrac → « Ranger par type / par date » (annulable `Ctrl+Z`).

### 🌿 Git intégré (natif libgit2)

- Pastilles d'état directement sur les fichiers/dossiers de l'explorateur (modifié / nouveau / supprimé), togglables
- Panneau Git assignable à une zone : statut, **ahead/behind**, index/modifications séparés,
  stage/unstage par fichier, commit, bascule de branche, historique
- **Diff inline** HEAD ↔ disque (bouton `⇄` par fichier), sans jamais appeler le binaire `git`

### 🤖 Agent IA intégré (control plane)

Lance `claude` dans le terminal intégré et Claude Code pilote l'interface de Vela via un
serveur MCP souverain (socket Unix, zéro réseau). Il peut :

| Tool | Action sur l'UI |
|---|---|
| `open_file` / `preview_content` | Afficher un fichier ou un contenu généré dans l'éditeur |
| `open_url` / `hide_browser` | Piloter le navigateur intégré |
| `navigate` / `reveal_file` | Faire naviguer l'explorateur |
| `show_diff` / `compare_files` | Présenter un diff git ou comparer deux fichiers |
| `notify` | Signaler une étape clé (toast) |

L'isolation est stricte : ce MCP n'existe **que** dans le terminal de Vela, jamais dans une
session Claude normale. Aucune config globale n'est modifiée.

### 🔎 Recherche globale · 🌍 Traduction · 📄 OCR

- Index des noms de fichiers construit en tâche de fond, interrogeable instantanément
- Traduction locale (Argos Translate, offline) sur sélection de texte ou fichier entier
- OCR local (tesseract) sur image ou PDF → texte écrit à côté de la source
- **Téléchargeur** YouTube / Spotify local (yt-dlp + spotdl) : playlists, formats, sous-titres, lot

---

## Là où Vela gagne

- **Tout au même endroit.** Éditer, convertir, retoucher, naviguer le web, commit, télécharger,
  sans ouvrir une seule autre application.
- **Recomposable.** Aucun autre gestionnaire ne te laisse redéfinir entièrement le layout par profil.
- **Souverain.** Zéro dépendance réseau imposée, zéro cloud, zéro coût variable. Si internet tombe,
  tout fonctionne encore.
- **Pensé pour l'IA.** Une interface qu'un agent (Claude Code) peut piloter, pas juste un dossier à parcourir.

## Là où les autres gagnent

- **Empreinte.** Nemo/Thunar (C + GTK natif) démarrent plus vite et consomment moins de RAM.
  Vela porte le poids de WebKitGTK, de CodeMirror et des previews inline. Trade-off assumé.
- **Très gros dossiers.** Plusieurs milliers d'entrées se sentent davantage que sur un client natif.
- **Maturité.** Nautilus et Dolphin ont 20 ans de finition et d'extensions tierces.
- **Plateformes.** Vela est Linux d'abord ; Dolphin tourne aussi sous Windows.

---

## Souveraineté, par conception

Tout le travail se fait sur ta machine. Édition, conversion, média, IA locale (vLLM/EchoHub),
recherche, traduction, OCR : aucun appel sortant obligatoire. Les outils externes (ffmpeg,
pandoc, LibreOffice, demucs, yt-dlp, tesseract) sont **optionnels** : absents, la fonction
disparaît proprement et le reste continue de tourner.

---

<div align="center">

**Vela** — un poste de travail déguisé en gestionnaire de fichiers.

[Dépôt](https://github.com/trinityUwU/vela) · Linux · MIT-ish · self-hosted

</div>
