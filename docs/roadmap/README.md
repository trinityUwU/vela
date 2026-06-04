# Roadmap Vela — Vague 3

> Réflexion de fond sur les 24 prochaines fonctionnalités. Chaque pilier a son document
> détaillé (problème, persona, UX, backend, frontend, dépendances, effort, risques, definition of done).
> Ce fichier est l'index + la vision + la priorisation.

## Le cap

Vela est déjà un poste de travail déguisé en gestionnaire de fichiers (édition, média, navigateur,
git, agent IA). La vague 1 a posé les réflexes (vue liste, historique, terminal ici). La vague 2 a
posé la polyvalence média + le control plane MCP. **La vague 3 a deux objectifs simultanés :**

1. **Solidifier le socle.** Aujourd'hui les opérations de fichiers (copie/déplacement/conflits) et la
   navigation (un seul dossier à la fois) sont plus fragiles que sur un Nautilus ou un Dolphin. On
   répare ça d'abord. Une feature qui repose sur un socle bancal ne tient pas.
2. **Élargir la polyvalence** sans trahir la simplicité : un développeur, un chercheur, un rédacteur,
   un monteur audio/vidéo amateur doivent tous y trouver un outil qui leur évite d'ouvrir une autre app.

Référence d'ambition pour le média : **GarageBand, pas Pro Tools**. Puissant, accessible, opinioné.
Pareil partout : on vise l'outil à 80 % des besoins en 20 % de la complexité.

## Sept principes qui filtrent chaque idée

1. **Accessible en deux endroits, toujours.** Toute action utile doit être atteignable depuis la
   **palette `Ctrl+K`** (registre `useCommandRegistry`) ET, quand c'est un comportement, togglable dans
   les **Réglages**. Si une feature n'a pas sa place dans l'un des deux, on se demande si elle existe.
2. **Dégradation gracieuse.** Tout outil externe est optionnel. Pattern `*_capabilities()` déjà en place
   (download, convert, media) : absent → l'entrée disparaît proprement, le reste tourne. Jamais d'erreur
   dans la figure de l'utilisateur parce qu'un binaire manque.
3. **Souveraineté d'abord.** À fonction égale, on choisit la **crate Rust pure** plutôt qu'un binaire
   externe (ex. `age` pour le chiffrement, `lofty` pour les tags audio, `russh` pour SFTP, `qrcode`).
   Zéro réseau imposé, zéro cloud, zéro coût variable.
4. **Réutiliser les patterns, pas en inventer.** Jobs longs = manager Tauri + commande `start` qui rend
   un `jobId` + events `*-progress` + `cancel` (cf. `download_job`, `archive`, `video`). Non-destructif =
   modèle « ouvre → paramètre → exporte » (cf. outils média). On clone, on n'improvise pas.
5. **Non-destructif par défaut.** Toute transformation écrit un nouveau fichier (`_edited`, `_compressed`)
   ou est annulable (`useUndo`). On ne touche jamais l'original sans le dire.
6. **La simplicité est une feature.** Une option de plus dans un menu déjà chargé est un coût. On préfère
   une action contextuelle intelligente (le menu s'adapte à la sélection) à dix entrées permanentes.
7. **Le control plane est un multiplicateur.** Chaque nouvelle capacité backend devrait, quand ça a du
   sens, être exposée aussi au MCP `vela` pour que Claude puisse la piloter (ex. « transcris cette vidéo »,
   « chiffre ce dossier »). On gagne deux features pour le prix d'une.

## Les 24, en un tableau

Effort : **S** ≤1j · **M** 2-4j · **L** ~1 semaine · **XL** >1 semaine. Souv. = 100 % crate Rust pure (✅)
ou dépend d'un outil externe optionnel (◑).

| # | Feature | Pilier | Pour qui | Effort | Souv. |
|---|---------|--------|----------|:---:|:---:|
| F01 | Centre de transferts + gestion de conflits | Fondations | Tous | L | ✅ |
| F02 | Onglets de dossiers | Fondations | Tous | M | ✅ |
| F03 | Volet jumeau (dual-pane) opérationnel | Fondations | Power user | M | ✅ |
| F04 | Sélection avancée + barre d'état riche | Fondations | Tous | S | ✅ |
| F05 | Recherche avancée + dossiers intelligents | Recherche | Chercheur, tous | M | ✅ |
| F06 | Rechercher & remplacer multi-fichiers | Recherche | Dev, rédacteur | M | ✅ |
| F07 | Recherche sémantique de documents + « Demander à ce dossier » | Recherche | Chercheur | L | ◑ |
| F08 | Détection de projet + task runner | Dev | Dev | M | ✅ |
| F09 | Checksums, intégrité & type réel | Dev | Dev, parano | S | ✅ |
| F10 | Éditeur hexadécimal | Dev | Dev, reverse | S | ✅ |
| F11 | Connexions distantes SFTP/SSH | Dev | Dev, sysadmin | L | ✅ |
| F12 | Boîte à outils PDF | Documents | Tous, bureau | M | ◑ |
| F13 | Markdown studio | Documents | Rédacteur, dev | M | ◑ |
| F14 | Galerie / lightbox + EXIF + palette | Image | Photo, créa | M | ✅ |
| F15 | Optimisation & conversion image par lot | Image | Web, créa | M | ✅ |
| F16 | Annotation de captures | Image | Support, dev | M | ✅ |
| F17 | Studio audio (enregistreur + waveform + tags) | Audio | Créa, podcast | L | ◑ |
| F18 | Boîte à outils vidéo étendue + hover scrub | Vidéo | Créa | M | ◑ |
| F19 | Transcription locale (Whisper) | IA locale | Chercheur, créa | L | ◑ |
| F20 | Actions IA sur fichiers (renommage, résumé, tags) | IA locale | Tous | M | ◑ |
| F21 | Chiffrement, coffre-fort & strip metadata | Sécurité | Parano, pro | M | ✅ |
| F22 | Partage LAN éphémère + QR | Partage | Tous | M | ✅ |
| F23 | Règles d'automatisation (type Hazel) | Automatisation | Power user | L | ✅ |
| F24 | Templates & espaces de travail | Automatisation | Tous | S | ✅ |

## Priorisation — quatre vagues

**Vague 3.0 — Réparer le socle (avant tout le reste).**
F01, F02, F04, F09. Ce sont les fragilités structurelles. Tant qu'on ne navigue pas en onglets et que la
copie ne gère pas les conflits, Vela perd contre n'importe quel file manager mature. Petit effort cumulé,
gros gain de crédibilité.

**Vague 3.1 — Quick wins à fort effet de levier.**
F24 (templates/workspaces, S), F10 (hex, S), F16 (annotation captures, M), F12 (PDF, M), F22 (partage LAN, M).
Chacun est une raison concrète d'ouvrir Vela plutôt qu'autre chose. Faible risque, démos parlantes.

**Vague 3.2 — Polyvalence métier.**
F05, F06, F13, F14, F15, F18, F08, F03. Le gros de la valeur par persona. À piocher selon l'usage réel.

**Vague 3.3 — Les paris (révolutionnaire / souverain).**
F07 (RAG « demander à ce dossier »), F19 (Whisper), F20 (actions IA), F21 (coffre-fort), F23 (automatisation),
F11 (SFTP), F17 (studio audio). Plus d'effort, mais c'est là que Vela devient unique. Tous s'appuient sur
l'infra déjà là (EchoHub, control plane, venvs optionnels).

## Matrice impact / effort (vue rapide)

```
        FORT IMPACT
            │  F02  F01            F07  F19
            │  F04  F05  F12       F17  F23
            │  F09  F16  F22  F06  F11  F20
   ─────────┼──────────────────────────────  EFFORT →
            │  F24  F10  F13  F14  F18  F03
            │            F15  F08            F21
        FAIBLE IMPACT
```

Lecture : commencer en haut-à-gauche (fort impact / faible effort) — F02, F04, F01, F09, F24, F16.

## Les documents détaillés

- [`01-fondations.md`](01-fondations.md) — F01 à F04 (le socle)
- [`02-recherche-savoir.md`](02-recherche-savoir.md) — F05 à F07
- [`03-dev.md`](03-dev.md) — F08 à F11
- [`04-documents-texte.md`](04-documents-texte.md) — F12, F13
- [`05-image.md`](05-image.md) — F14 à F16
- [`06-audio-video.md`](06-audio-video.md) — F17, F18
- [`07-ia-locale.md`](07-ia-locale.md) — F19, F20
- [`08-securite-partage-automatisation.md`](08-securite-partage-automatisation.md) — F21 à F24

## Ce que cette vague NE fait pas (garde-fous)

- Pas de timeline de montage vidéo/audio multipiste. On reste sur « ouvre → paramètre → exporte ».
- Pas de retouche image avancée (calques, masques, pinceau). L'annotation (F16) est l'exception assumée.
- Pas de sync cloud propriétaire. Le partage est LAN (F22), les remotes sont les siens (F11).
- Pas de dépendance lourde imposée. Tout ce qui pèse (Whisper, RAG, demucs) reste opt-in via venv/binaire.
