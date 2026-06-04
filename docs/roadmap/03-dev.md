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

**L'idée.** Monter un serveur distant comme un dossier dans Vela : naviguer en SFTP, éditer, copier vers/depuis,
comme en local. En restant souverain (ce sont **tes** serveurs, pas un cloud tiers).

**Cadrage (retour Chris) — rester léger, ne pas refaire Tabby.** Chris utilise déjà **Tabby** pour le
terminal SSH multi-onglets ; Vela n'a pas à dupliquer ça. La valeur de Vela = **l'accès fichiers** (SFTP),
pas un multiplexeur de terminaux. On vise donc une notion simple :
- Des **connexions sauvegardées** : `host`, `port` (**22 par défaut**, modifiable), `user`, `password`
  (optionnel). Auto-login si le mot de passe est configuré. Clé SSH supportée aussi (alternative au password).
- **Pas** de gestion avancée façon Tabby (tunnels, profils complexes, terminaux multiples). On s'arrête à :
  connecter, parcourir, éditer, transférer.

**Pour qui.** Devs qui déploient, sysadmins, quiconque a un VPS (Chris a un OVH VPS).

**Comment ça vit dans Vela.**
- Sidebar → section **« Distant »** → « Ajouter une connexion » (formulaire : host, port=22, user, mot de
  passe **ou** clé). Connexions persistées dans `~/.config/vela/remotes.json` (**sans le secret en clair** —
  cf. décision de stockage ci-dessous).
- Clic sur une connexion → **auto-connexion** (login auto si mot de passe/clé enregistré), le serveur apparaît
  comme un **lieu** dans la sidebar ; navigation, ouverture dans l'éditeur, copier-coller local↔distant.
- **Édition distante** : ouvrir un fichier distant le met en cache temp, l'édite, **réuploade à `Ctrl+S`**.
  Indicateur « distant » sur l'onglet.
- **Palette** : « Se connecter à… », chaque connexion = une entrée.

**Stockage du secret — décidé : keyring système.** Le mot de passe va dans le **keyring (secret-service /
libsecret)** via la crate `keyring`. `remotes.json` ne garde que les métadonnées (host/port/user) + une
référence d'entrée keyring, jamais le secret en clair. **Fallback si aucun daemon keyring ne tourne** (Hyprland
minimal) : chiffré au repos avec la brique `age` de F21 (passphrase maître au déverrouillage). On détecte la
présence du secret-service au runtime et on bascule proprement.

**Backend.**
- Crate **`russh`** + `russh-sftp` (SSH/SFTP **100 % Rust pur**, pas de libssh2 système → souveraineté ✅).
  Un `RemoteManager` (état Tauri) tient les sessions. Commandes : `remote_connect(cfg)`, `remote_list`,
  `remote_read`, `remote_write`, `remote_stat`, `remote_transfer` (local↔remote, réutilise le centre de
  transferts F01), `remote_disconnect`.
- Auth par mot de passe (auto-login) **ou** clé (`~/.ssh/id_*`)/agent. Known-hosts respecté (TOFU avec
  confirmation au premier contact).

**Frontend.**
- `useRemotes` (CRUD connexions). Le listing/éditeur deviennent **source-agnostiques** : un chemin peut être
  local ou `remote://id/chemin`. C'est le vrai travail — abstraire la couche fichier côté front (préfixe
  d'URI routé vers les bonnes commandes).

**Dépendances.** `russh`/`russh-sftp` (pures) ; keyring (`secret-service`) optionnel pour le secret.
Souveraineté ✅.

**Effort.** L (l'abstraction local/remote du listing est le morceau délicat ; le reste est cadré léger).

**Risques.** Latence réseau → async + indicateurs, jamais bloquer l'UI. Déconnexions → reconnect propre.
Secret jamais en clair par défaut (cf. décision de stockage). `fs-changed` n'existe pas en SFTP →
rafraîchissement manuel/polling léger du dossier distant ouvert.

**Fini quand.** J'ajoute mon VPS OVH (host + port 22 + user + mot de passe), un clic me connecte
automatiquement, je navigue dans `/var/www`, j'édite un fichier de conf, `Ctrl+S` le réécrit sur le serveur,
et je glisse un fichier local vers le distant via le centre de transferts.
