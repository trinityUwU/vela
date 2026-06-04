# Pilier 0 — Fondations & robustesse

> Le socle. Tant que ces quatre points ne sont pas réglés, Vela reste « impressionnant mais fragile ».
> C'est ce qui sépare un prototype riche d'un outil quotidien. À traiter **avant** les nouveautés.

---

## F01 · Centre de transferts + gestion de conflits

**Le manque.** Aujourd'hui une copie/déplacement de gros volume part en tâche de fond (`TransferManager`,
pause/reprise/annulation existent) mais il manque le réflexe que tout file manager mature a : **que se
passe-t-il quand le fichier existe déjà à destination ?** Et **où voit-on l'ensemble des opérations en
cours ?** Sans ça, on perd des données par écrasement silencieux ou on bloque sur une erreur opaque.

**Pour qui.** Tout le monde. C'est le cœur du métier d'un gestionnaire de fichiers.

**Comment ça vit dans Vela.**
- Une **modale de conflit** quand une collision est détectée : aperçu côte à côte (nom, taille, date des
  deux versions) + choix **Remplacer / Ignorer / Garder les deux (renommer) / Fusionner (dossiers)**, avec
  une case **« Appliquer à tout »** pour ne pas répondre 200 fois.
- Un **centre de transferts** : petit panneau en bas à droite (réutilise le pattern de `ExtractionPanel`)
  listant TOUS les jobs actifs (copie, déplacement, extraction, compression, conversion, download) avec
  barre de progression, vitesse, ETA, pause/annulation par job. Un seul endroit pour tout voir.
- **Palette** : « Voir les transferts en cours ». **Réglages** : politique de conflit par défaut
  (Demander / Toujours garder les deux / Toujours ignorer), vérification d'intégrité on/off.

**Backend.**
- Étendre `ops::copy_entries` / `move_entries` : avant écriture, détecter la collision et, selon la
  politique, soit appliquer, soit **émettre un event `transfer-conflict { jobId, src, dest, infos }` et
  attendre** une commande `transfer_resolve(jobId, choice, applyAll)`. Canal de résolution via
  `Mutex<HashMap<jobId, Sender>>` dans le `TransferManager`.
- Renommage auto « garder les deux » : `fichier (2).ext`, incrémenté.
- Fusion de dossiers : descente récursive, conflits feuille par feuille.
- **Vérification d'intégrité optionnelle** : hash (xxhash, crate `twox-hash`, ultra rapide) source vs
  destination après copie ; mismatch → job en `error` au lieu de `done`. Mutualise avec F09.
- Reprise sur copie interrompue : si la destination partielle existe et que la taille < source, reprendre
  l'offset (best-effort, derrière un flag).

**Frontend.**
- `useTransfers` (déjà là) → ajouter l'écoute `transfer-conflict` et exposer une file de conflits.
- `ConflictModal.tsx` (nouveau) : empile les conflits, gère « appliquer à tout ».
- `TransferCenter.tsx` : généralise `ExtractionPanel` à tous les types de jobs (source unique = un store
  de jobs unifié `useJobs`, qui agrège download/extraction/transfer/convert).

**Dépendances.** Aucune (crates Rust pures). Souveraineté ✅.

**Effort.** L. C'est de la plomberie soignée, beaucoup d'edge cases.

**Risques / edge cases.** Liens symboliques (ne pas suivre aveuglément), permissions refusées en cours de
job (proposer Réessayer/Ignorer), copie sur le même volume vs cross-device (rename atomique vs copie),
destination = sous-dossier de la source (interdire), espace disque insuffisant (vérifier en amont).

**Fini quand.** Copier 1000 fichiers avec 50 collisions → une seule décision « appliquer à tout » suffit ;
le centre de transferts montre les 4 types de jobs simultanément ; couper une copie à mi-chemin ne laisse
pas de fichier corrompu silencieux.

---

## F02 · Onglets de dossiers

**Le manque.** Vela navigue **un seul dossier à la fois**. Tous les file managers sérieux (Nautilus, Dolphin,
Files) ont des onglets de dossiers. C'est le manque structurel le plus visible. Les profils recomposent le
*layout*, mais ne remplacent pas le besoin de garder trois dossiers ouverts et de basculer entre eux.

**Pour qui.** Tout le monde, en permanence.

**Comment ça vit dans Vela.**
- Une **barre d'onglets** au-dessus du listing (dans la zone listing, pas la topbar globale — elle suit le
  panneau, pas la fenêtre). `Ctrl+T` nouvel onglet (dossier courant), `Ctrl+W` ferme, `Ctrl+Tab` cycle,
  `Ctrl+1..9` saut direct. Clic milieu ferme. Glisser un dossier sur la barre → ouvre dans un nouvel onglet.
- Chaque onglet garde **son propre cwd, son historique back/forward, sa sélection et son scroll**.
- **Palette** : « Nouvel onglet », « Fermer l'onglet », « Rouvrir le dernier onglet fermé ».
- **Réglages** : « Restaurer les onglets au démarrage » (on/off).

**Backend.** Quasi rien — c'est de l'état front. Persistance optionnelle des onglets ouverts dans
`~/.config/vela/session.json` (réutilise le pattern `profiles.json`).

**Frontend.**
- Le gros du chantier : `useFileManager` gère aujourd'hui **un** cwd/historique/sélection. Il faut le
  transformer en **`useTabs`** qui détient un tableau d'« onglets », chacun encapsulant un état de
  navigation, + un index actif. Soit on instancie la logique de nav par onglet, soit on externalise
  l'état de nav dans une structure sérialisable et `useFileManager` opère sur l'onglet actif.
- `TabBar.tsx` (nouveau). Réutilise la mécanique de `EditorArea` (onglets éditeur déjà faits : drag,
  clic-milieu, menu contextuel) — on a déjà le modèle UI sous la main.
- Interaction avec les profils : un profil définit le layout, les onglets vivent dans le panneau listing
  quel que soit le profil. Onglets conservés à travers un changement de profil.

**Dépendances.** Aucune. Souveraineté ✅.

**Effort.** M — mais c'est un refacto de `useFileManager`, à faire proprement et tester (sélection multiple,
watch fs-changed par onglet, undo). Risque de régression si bâclé.

**Risques.** `useGitStatus`, `useSearch`, le watcher live sont liés au cwd → doivent suivre l'onglet actif
sans fuiter d'un onglet à l'autre. Le watcher peut rester scopé à l'onglet actif (pas de watch des onglets
inactifs, on rafraîchit à la bascule).

**Fini quand.** Trois dossiers ouverts, `Ctrl+Tab` instantané, chaque onglet garde sa position de scroll et
sa sélection ; fermer puis `Ctrl+Shift+T` rouvre le dernier ; au redémarrage (si activé) les onglets reviennent.

---

## F03 · Volet jumeau (dual-pane) opérationnel

**Le manque.** Les profils permettent déjà `listing | listing` côte à côte, mais les deux volets ne se
« connaissent » pas : pas de copie ciblée de l'un vers l'autre, pas de notion de volet actif/inactif. Le
dual-pane à la Total Commander / Krusader est l'outil de copie le plus efficace qui existe pour qui gère
beaucoup de fichiers.

**Pour qui.** Power users, sysadmins, photographes qui trient.

**Comment ça vit dans Vela.**
- Un profil fourni **« Jumeau »** (`listing | listing`). Le volet **actif** est cerclé d'un liseré d'accent.
  `Tab` bascule l'actif. Les opérations prennent l'actif comme source et l'inactif comme destination.
- Raccourcis hérités du genre : **`F5` copier vers l'autre volet**, **`F6` déplacer vers l'autre volet**,
  une barre d'actions discrète entre les deux (`→ Copier`, `→ Déplacer`, `⇄ Synchroniser`).
- **« Synchroniser »** réutilise `compare_dirs` (déjà là, F-existant) pour ne transférer que les différences,
  avec un récap avant exécution.
- **Palette** : « Activer le volet jumeau », « Copier vers l'autre volet ».

**Backend.** Rien de neuf : `copy_entries`/`move_entries` (enrichis par F01) + `compare_dirs`. Le « sync »
est un `compare_dirs` → liste de diffs → transferts.

**Frontend.**
- Notion de **volet actif** dans `ZoneLayout` quand deux listings coexistent (état `activePane: 'a'|'b'`).
  Aujourd'hui un seul état de sélection global → il faut un état de nav par volet (ce que F02 prépare déjà :
  un volet = un onglet « épinglé » à une zone). **F03 dépend conceptuellement de F02** (état de nav multiple).
- `TwinBar.tsx` : la barre d'actions inter-volets.

**Dépendances.** Aucune. Souveraineté ✅.

**Effort.** M (réduit si F02 est fait avant, car l'état de nav multiple existe déjà).

**Risques.** Cohérence quand l'utilisateur met `listing|listing` via l'éditeur de profils custom (pas que via
le profil fourni) → détecter « deux listings » génériquement, pas un id de profil en dur.

**Fini quand.** Profil Jumeau, `Tab` change le volet actif, `F5` copie la sélection vers l'autre volet avec la
modale de conflit de F01, « Synchroniser » ne transfère que les différences.

---

## F04 · Sélection avancée + barre d'état riche

**Le manque.** Deux petites choses qui manquent et qu'on sent tout le temps : (1) **sélectionner par motif**
(« tous les `.png` », « tout sauf les dossiers », inverser la sélection), et (2) une **barre d'état** qui
dit ce qui est sélectionné et combien d'espace il reste. Aujourd'hui on sélectionne à la main et on ne sait
pas instantanément « j'ai pris combien de Go ? ».

**Pour qui.** Tout le monde. C'est du confort à très haut ratio valeur/effort.

**Comment ça vit dans Vela.**
- **Barre d'état** fine en bas du listing : `X éléments · Y sélectionnés · Z Go` à gauche ; à droite
  l'**espace libre du volume courant** (`12,3 Go libres sur 256 Go`). Discrète, masquable (Réglages).
- **Sélection par motif** (`Ctrl+Maj+S` ou palette « Sélectionner par motif… ») : un champ glob/regex
  (`*.jpg`, `IMG_*`, `/^draft/i`). Plus : **Inverser la sélection** (`Ctrl+I`), **Tout désélectionner**.
- Sélection rapide depuis le **clic droit sur un fichier** : « Sélectionner tous les `.ext` du dossier ».
- **Palette** : « Sélectionner par motif », « Inverser la sélection ». **Réglages** : afficher la barre d'état.

**Backend.**
- Une commande `disk_free(path) -> (free, total)` (crate `sysinfo` ou `nix::statvfs`, pur Rust). Petit.
- Le reste est front (la taille sélectionnée se calcule depuis les `DirEntry` déjà chargés ; pour les
  dossiers, réutiliser la taille calculée à la demande ou afficher `—` tant que non calculée).

**Frontend.**
- `StatusBar.tsx` (nouveau), branché sur la sélection de `useFileManager` et `disk_free` (cache par volume).
- Helper `matchPattern(name, pattern)` dans `path-util.ts` (glob simple + regex si `/.../`), testé.
- Actions de sélection dans `useFileManager` (`selectByPattern`, `invertSelection`).

**Dépendances.** `sysinfo` ou `nix` (déjà transitif probablement). Souveraineté ✅.

**Effort.** S.

**Risques.** Performance du calcul de taille sélectionnée sur très grande sélection (mémoïser). Regex
utilisateur invalide → message clair, pas de crash.

**Fini quand.** Sélectionner tous les `.png` en une commande, voir « 47 sélectionnés · 1,2 Go » en bas, et
l'espace disque restant sans ouvrir l'analyseur.
