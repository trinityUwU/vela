# Pilier 1 — Recherche & savoir

> Retrouver, transformer en masse, et interroger ses propres fichiers. Le terrain du chercheur, du dev et
> du rédacteur. Vela a déjà la recherche live dans un dossier, l'index de noms global et CodeIndex pour le
> code. Cette vague comble le reste : recherche multi-critères persistante, find&replace, et RAG local.

---

## F05 · Recherche avancée + dossiers intelligents

**Le manque.** La recherche actuelle est binaire (Nom / Contenu) sur le dossier courant. Il manque les
**critères combinés** (type + taille + date + contenu) et surtout la **persistance** : un chercheur veut
sauver « tous les PDF modifiés ce mois-ci dans Documents » comme un dossier qu'il rouvre d'un clic.

**Pour qui.** Chercheurs, juristes, tout le monde qui accumule.

**Comment ça vit dans Vela.**
- Un **panneau de recherche avancée** (overlay ou zone) : champs combinables — nom (glob/regex), contenu
  (texte/regex), type/extension, plage de taille, plage de date, dossier racine + récursif on/off, fichiers
  cachés on/off. Résultats dans le listing normal (mêmes interactions : ouvrir, tags, clic droit).
- **Dossiers intelligents** : bouton « Enregistrer cette recherche ». Apparaît dans la **sidebar** sous une
  section « Recherches » avec une icône loupe. Clic → ré-exécute la requête live (toujours à jour). Persisté
  dans `~/.config/vela/smart-searches.json`.
- **Palette** : « Recherche avancée », et chaque dossier intelligent devient une entrée palette
  (`group: "Recherches"`).

**Backend.**
- Étendre `ops::search_content` / `fs_ops::search_dir` en **une commande `search_advanced(criteria)`** :
  walkdir + filtres composables, contenu via lecture bornée (skip binaires, cap par fichier), regex via
  crate `regex`. Pagination/cap de résultats (déjà le réflexe : 150).
- Possibilité d'accélérer le contenu en shellant `ripgrep` si présent (capabilities), sinon walkdir maison.

**Frontend.**
- `AdvancedSearch.tsx` (overlay façon `OverlayHost`). 
- `useSmartSearches` (CRUD + persistance, calqué sur `useFavorites`).
- Injection des dossiers intelligents dans `useCommandRegistry` (nouveau `CommandGroup: "Recherches"`).

**Dépendances.** `regex` (crate), `ripgrep` optionnel pour la vitesse. Souveraineté ✅.

**Effort.** M.

**Risques.** Recherche contenu sur l'arbre `$HOME` entier = lente → toujours bornée à une racine choisie,
jamais `/` par défaut ; afficher la progression (job long si > N fichiers).

**Fini quand.** « PDF > 5 Mo modifiés après le 1er du mois » donne des résultats, je l'enregistre, il
apparaît dans la sidebar et la palette, et se met à jour quand j'ajoute un fichier correspondant.

---

## F06 · Rechercher & remplacer multi-fichiers

**Le manque.** Aucun moyen de remplacer une chaîne dans 30 fichiers d'un coup. C'est un réflexe quotidien
du dev (renommer une variable, changer une URL) et du rédacteur (corriger un terme partout). Aujourd'hui il
faut sortir de Vela (sed, IDE). C'est exactement le genre d'outil qui fait rester dans l'app.

**Pour qui.** Développeurs, rédacteurs, traducteurs.

**Comment ça vit dans Vela.**
- Clic droit sur un dossier ou une sélection → « Rechercher & remplacer ici… », ou **palette**.
- Overlay en deux temps : (1) saisie **chercher** (texte/regex, sensible à la casse, mot entier, filtre
  d'extensions) + **remplacer** ; (2) **prévisualisation** : liste des fichiers touchés, chaque occurrence
  montrée en contexte (ligne avant/après) avec une **case par occurrence** pour inclure/exclure. Bouton
  « Remplacer les N occurrences cochées ».
- **Sécurité** : l'opération est **enregistrée dans `useUndo`** (sauvegarde des fichiers avant écriture →
  `Ctrl+Z` restaure). Affiche un récap « 23 remplacements dans 8 fichiers ».

**Backend.**
- `search_replace_preview(criteria) -> [{file, [{line, col, before, after}]}]` : walkdir + regex, lecture
  bornée, skip binaires (réutilise la détection de F09 `infer`).
- `search_replace_apply(selection) -> report` : réécriture atomique (fichier temp + rename), retourne les
  chemins+contenus d'origine pour l'undo.

**Frontend.**
- `FindReplace.tsx` (overlay). Réutilise le rendu diff/contexte (on a déjà `DiffViewer` et la coloration).
- Branchement `useUndo` : nouvelle `UndoEntry` de type `bulk-edit` qui restaure N fichiers.

**Dépendances.** `regex`. Souveraineté ✅.

**Effort.** M.

**Risques.** Remplacement regex avec groupes de capture (`$1`) → bien documenter dans le champ. Encodages
non-UTF8 (skip + signaler). Énorme nombre d'occurrences → paginer la preview.

**Fini quand.** Remplacer `oldName` par `newName` dans tout un dossier `src/`, prévisualiser, décocher deux
faux positifs, appliquer, puis `Ctrl+Z` annule tout proprement.

---

## F07 · Recherche sémantique de documents + « Demander à ce dossier »

**Le pari.** CodeIndex fait déjà de la recherche sémantique sur le **code**. On étend le principe à
**tous les documents** (PDF, txt, md, docx, odt) : retrouver un fichier par le **sens** (« le contrat où on
parle de pénalités de retard ») et, mieux, **poser une question à un dossier** et obtenir une réponse
sourcée — un RAG local, 100 % souverain, sur ses propres fichiers. C'est la feature la plus « hors du
commun » de la vague, et toute l'infra existe déjà chez Echo (ChromaDB, BGE-M3, EchoHub).

**Pour qui.** Chercheurs, juristes, étudiants, quiconque a un corpus.

**Comment ça vit dans Vela.**
- Clic droit sur un dossier → **« Indexer pour la recherche sémantique »** (job long, progression). Une fois
  indexé, le dossier porte un petit badge « ⌘ indexé ».
- Deux usages :
  1. **Recherche sémantique** depuis la palette ou un champ dédié → résultats = fichiers classés par
     pertinence avec l'extrait qui matche.
  2. **« Demander à ce dossier… »** → un panneau de chat léger : on pose une question, EchoHub (LLM local)
     répond en citant les fichiers sources (cliquables → `open_file`). Réponse strictement basée sur le corpus.
- **Réglages** : modèle d'embedding, taille de chunk, ré-indexation auto on fs-changed (off par défaut, coûteux).
- **Synergie control plane** : exposer `ask_folder(path, question)` au MCP → Claude peut interroger un corpus.

**Backend.**
- Calqué sur `codeindex.rs` (pont CLI vers un venv dédié `~/.local/share/vela/rag-venv`). Pipeline :
  extraction texte (pdf via `pdftotext`/`pymupdf`, docx/odt via pandoc déjà présent) → chunking → embeddings
  **BGE-M3** → stockage **ChromaDB** local. Recherche = embedding requête + top-k. Q&A = top-k chunks →
  prompt EchoHub (API Messages locale déjà câblée dans `nl.ts`).
- Commandes : `rag_capabilities`, `rag_index(path)` (job long + progress), `rag_search(query)`,
  `rag_ask(path, question) -> {answer, sources[]}`.

**Frontend.**
- `useRag` (capabilities + état d'indexation). `SemanticSearch.tsx` + `AskFolder.tsx` (mini-chat, réutilise
  le style de la palette). Sources cliquables → ouverture éditeur.

**Dépendances.** venv optionnel (sentence-transformers/BGE-M3, chromadb, pymupdf) + EchoHub pour le Q&A.
Tout local. Dégradation : pas de venv → entrées masquées, installation proposée (pattern demucs).

**Effort.** L.

**Risques.** Coût d'indexation sur gros corpus (job long obligatoire, jamais bloquant). Hallucination du Q&A
→ forcer la citation des sources et un ton « d'après ces fichiers… ». Première install lourde (modèles) →
opt-in clair, comme demucs.

**Fini quand.** J'indexe un dossier de 200 PDF, je tape « clause de non-concurrence » et je tombe sur le bon
contrat ; je demande « quelle est la durée d'engagement ? » et j'obtiens une réponse avec le PDF source cliquable.
