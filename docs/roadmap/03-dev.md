# Pilier 2 — Outils développeur

> Vela tourne déjà dans le flux d'un dev (éditeur CodeMirror, git natif, terminal intégré, control plane
> Claude). Ces quatre features le rendent collant pour le travail de code au quotidien, sans devenir un IDE.

---

## F08 · Détection de projet + task runner

**L'idée.** Quand on entre dans un dossier qui est un projet (présence de `package.json`, `Cargo.toml`,
`Makefile`, `pyproject.toml`, `.git`…), Vela le **reconnaît** et propose les **commandes pertinentes** au bon
endroit, sans qu'on tape quoi que ce soit. « bun install », « cargo build », « make test », les scripts npm/bun.

**Pour qui.** Développeurs.

**Comment ça vit dans Vela.**
- À l'entrée dans un dossier-projet, une **puce discrète** dans la barre du listing : `⬡ bun · 5 scripts`.
  Clic → liste des tâches détectées. Chaque tâche s'exécute dans un **onglet terminal** (réutilise le PTY)
  pour garder la sortie interactive et visible.
- Les tâches du projet courant sont **injectées dans la palette** (`group: "Tâches"`) : taper `dev` trouve
  `bun run dev`. C'est l'accès le plus rapide.
- **Réglages** : activer/désactiver la détection, liste des fichiers-marqueurs.

**Backend.**
- `project_detect(path) -> { kind, tasks: [{label, command}] }` : lit `package.json#scripts`, les cibles
  `Makefile` (parse simple), présence Cargo/pyproject → tâches standard. Pur Rust (`serde_json`, regex).
- Exécution = on réutilise le `TerminalManager` (`term_open` dans le cwd + `term_input` la commande), ou un
  job capturé si l'utilisateur veut juste la sortie (réutilise le pattern jobs).

**Frontend.**
- `useProject(cwd)` (détection mémoïsée par dossier). `ProjectBadge.tsx`. Injection palette via
  `useCommandRegistry` (nouveau groupe `"Tâches"`).

**Dépendances.** Aucune (les runtimes type bun/cargo sont ceux de l'utilisateur, détectés, jamais imposés).
Souveraineté ✅.

**Effort.** M.

**Risques.** Ne pas se transformer en IDE : on **lance** des tâches, on ne gère pas de configuration de build.
Sécurité : on n'exécute jamais une tâche automatiquement, toujours sur action explicite.

**Fini quand.** J'entre dans un repo bun, je tape `Ctrl+K` puis « dev » et `bun run dev` se lance dans un
terminal, sans avoir cherché la commande.

---

## F09 · Checksums, intégrité & type réel

**L'idée.** Deux outils que tout dev/parano finit par vouloir : **calculer/vérifier un hash** (md5, sha1,
sha256, blake3) et **connaître le vrai type d'un fichier** par ses magic bytes (pas juste l'extension). Sert
aussi de brique à F01 (vérif d'intégrité de copie).

**Pour qui.** Développeurs, gens prudents, qui téléchargent des ISO/binaires.

**Comment ça vit dans Vela.**
- Clic droit sur un fichier → **« Empreinte (hash)… »** : modale avec md5/sha1/sha256/blake3, bouton copier,
  et un champ **« Vérifier contre… »** où coller une somme attendue → ✅/❌ immédiat.
- Sélection de 2 fichiers → « Comparer les empreintes » (identiques ou non).
- Le **vrai type** apparaît dans les Propriétés : `Type réel : PNG (image/png)` même si le fichier s'appelle
  `photo.txt`. Signale les **incohérences extension/contenu** (utile sécurité).
- **Palette** : « Calculer une empreinte ».

**Backend.**
- `file_hash(path, algos) -> map` : crates `md-5`, `sha1`, `sha2`, `blake3` (toutes pures Rust), lecture
  streamée (pas de chargement intégral). Job long pour les gros fichiers (progress).
- `file_kind(path) -> { mime, ext_expected, mismatch }` : crate `infer` (magic bytes, pur Rust).

**Frontend.**
- `HashModal.tsx`. Ligne « Type réel » dans `PropertiesModal`. Helper côté `git-ui`/`file-kind` pour le badge
  d'incohérence.

**Dépendances.** Crates pures. Souveraineté ✅.

**Effort.** S.

**Risques.** Très gros fichiers → toujours streamer + job annulable. blake3 est rapide, le mettre en défaut.

**Fini quand.** Je vérifie le sha256 d'une ISO collé depuis un site et j'ai un ✅ vert ; un `.jpg` qui est en
fait un PDF est signalé dans les Propriétés.

---

## F10 · Éditeur hexadécimal

**L'idée.** Visualiser/éditer un fichier binaire en hex + ASCII. Indispensable pour le reverse, le debug de
format, l'inspection de headers. Petit, ciblé, mais aucun file manager grand public ne l'a.

**Pour qui.** Développeurs, reverse engineers, curieux de formats.

**Comment ça vit dans Vela.**
- Un **viewer hex** comme mode du visualiseur : pour un fichier binaire, le bouton « Voir en hexadécimal ».
  Affichage classique `offset | 16 octets hex | ASCII`. Lecture seule par défaut, **édition derrière un
  cadenas** (toggle explicite, sauvegarde non-destructive → `_edited`).
- Recherche par octets (`DE AD BE EF`) ou par texte ASCII. Saut à un offset. Sélection → copie en hex.
- **Palette** : « Ouvrir en hexadécimal ».

**Backend.**
- Réutilise `read_file_chunk` (déjà là pour les gros fichiers) — le hex viewer lit par fenêtres de 4–64 Ko
  selon le scroll, jamais tout en mémoire. Écriture d'un octet = patch d'offset (`write_file` ciblé ou
  nouvelle commande `patch_bytes(path, offset, bytes)`).

**Frontend.**
- `HexViewer.tsx` : virtualisation (ne rend que les lignes visibles — réutiliser le réflexe de la grille
  virtualisée si présent, sinon `react-window`). Composant pur, pas de dépendance lourde.

**Dépendances.** Aucune (front pur + commandes Rust existantes). Souveraineté ✅.

**Effort.** S–M (la virtualisation propre prend un peu de soin).

**Risques.** Fichiers énormes → virtualisation obligatoire, jamais de `read_file` intégral. Édition = derrière
confirmation, toujours non-destructive.

**Fini quand.** J'ouvre un `.bin` de 500 Mo instantanément, je scrolle sans freeze, je cherche `7F 45 4C 46`
(header ELF) et il me l'épingle.

---

## F11 · Connexions distantes SFTP/SSH

**Le pari.** Monter un serveur distant comme un dossier dans Vela : naviguer, éditer, copier vers/depuis,
exactement comme en local. C'est l'outil qui transforme Vela en vrai poste de travail dev/sysadmin et qui
remplace FileZilla — en restant souverain (ce sont **tes** serveurs, pas un cloud tiers).

**Pour qui.** Devs qui déploient, sysadmins, quiconque a un VPS (Chris a un OVH VPS).

**Comment ça vit dans Vela.**
- Sidebar → section **« Distant »** → « Ajouter une connexion » : hôte, port, user, clé/agent SSH (jamais de
  mot de passe stocké en clair — clé ou agent uniquement). Connexions persistées (sans secret) dans
  `~/.config/vela/remotes.json`.
- Une fois connecté, le serveur apparaît comme un **lieu** dans la sidebar. La navigation, l'ouverture de
  fichiers dans l'éditeur, le copier-coller local↔distant marchent de façon transparente.
- **Édition distante** : ouvrir un fichier distant le télécharge en cache temp, l'édite, et **réuploade à la
  sauvegarde** (`Ctrl+S`). Indicateur « distant » sur l'onglet.
- **Palette** : « Se connecter à… », chaque remote = une entrée.

**Backend.**
- Crate **`russh`** + `russh-sftp` (SSH/SFTP **100 % Rust pur**, pas de libssh2 système → souveraineté ✅).
  Un `RemoteManager` (état Tauri) tient les sessions. Commandes miroir de `fs_ops` mais préfixées :
  `remote_list`, `remote_read`, `remote_write`, `remote_stat`, `remote_transfer` (local↔remote, réutilise le
  centre de transferts F01).
- Auth par clé (`~/.ssh/id_*`) ou agent SSH. Known-hosts respecté (TOFU avec confirmation).

**Frontend.**
- `useRemotes` (CRUD connexions). Le listing/éditeur deviennent **source-agnostiques** : un chemin peut être
  local ou `remote://id/chemin`. C'est le vrai travail — abstraire la couche fichier côté front. À cadrer :
  soit un préfixe d'URI routé vers les bonnes commandes, soit un « provider » de système de fichiers.

**Dépendances.** `russh`/`russh-sftp` (crates pures). Souveraineté ✅.

**Effort.** L (l'abstraction local/remote du listing est le morceau délicat).

**Risques.** Latence réseau → tout doit être async + indicateurs de chargement, jamais bloquer l'UI. Gestion
des déconnexions (reconnect propre). Ne **jamais** stocker de secret en clair. Le watch fs-changed n'existe
pas en SFTP → rafraîchissement manuel/polling léger sur le dossier distant ouvert.

**Fini quand.** J'ajoute mon VPS OVH par clé, je navigue dans `/var/www`, j'édite un fichier de conf, `Ctrl+S`
le réécrit sur le serveur, et je glisse un fichier local vers le distant via le centre de transferts.
