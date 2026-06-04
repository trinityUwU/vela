# Pilier 7 — Sécurité, partage & automatisation

> Quatre features qui prolongent directement la valeur fondatrice de Vela (la souveraineté) et automatisent
> le travail répétitif. Protéger ses fichiers, les partager sans cloud, et laisser Vela ranger tout seul.

---

## F21 · Chiffrement, coffre-fort & strip metadata

**L'idée.** Chiffrer/déchiffrer un fichier ou un dossier en deux clics, avoir un **coffre-fort** (dossier
dont le contenu est chiffré au repos), une **suppression sécurisée** (effacement réel, pas juste corbeille),
et un **nettoyage de métadonnées** (EXIF des photos, propriétés des PDF/Office) avant de partager. C'est la
trousse « vie privée & confidentialité » qu'on attend d'un outil souverain.

**Pour qui.** Tous ceux qui manipulent des données sensibles : pros, juristes, journalistes, parano sain.

**Comment ça vit dans Vela.**
- Clic droit sur un fichier/dossier → **« Chiffrer… »** : passphrase (ou clé) → produit un `.age` (un seul
  fichier, même pour un dossier → archive chiffrée). « Déchiffrer… » fait l'inverse.
- **Coffre-fort** : un dossier marqué « coffre » apparaît verrouillé dans la sidebar ; l'ouvrir demande la
  passphrase, le contenu est déchiffré en session (temp en RAM/tmpfs) et re-chiffré à la fermeture. Modèle
  simple, pas de FUSE.
- **Suppression sécurisée** : clic droit → « Supprimer définitivement (sécurisé) » (écrasement avant unlink).
- **Strip metadata** : clic droit sur image/PDF/doc → « Retirer les métadonnées » (copie nettoyée). Mutualise
  avec le strip EXIF de F15.
- **Palette** : « Chiffrer », « Coffre-fort », « Nettoyer les métadonnées ».

**Backend.**
- Chiffrement : crate **`age`** (Rust pur, moderne, format simple, X25519/passphrase) → souveraineté ✅ totale,
  zéro binaire externe. `encrypt_path`, `decrypt_path` (dossier → tar+age). Jobs longs pour gros volumes.
- Suppression sécurisée : écrasement (1 passe aléatoire suffit sur SSD, le dire honnêtement) puis `remove`.
- Strip metadata : images via `image` (ré-encode sans EXIF), PDF via `lopdf` (F12), Office via réécriture
  (ou avertir des limites). `strip_metadata(path)`.

**Frontend.**
- `EncryptModal.tsx`, `useVault` (état des coffres, déverrouillage en session). Badge « verrouillé » sidebar/
  listing. Branchements menu + palette.

**Dépendances.** `age`, `lopdf`, `image` (toutes pures/présentes). Souveraineté ✅.

**Effort.** M (le coffre-fort « déchiffre en session » demande du soin sur le nettoyage du temp).

**Risques.** **Perte de passphrase = données perdues** : avertir clairement, pas de récupération. Le temp
déchiffré doit être nettoyé même au crash (tmpfs + cleanup au démarrage). Suppression « sécurisée » sur SSD
avec wear-leveling n'est pas garantie à 100 % → être honnête dans l'UI.

**Fini quand.** Je chiffre un dossier sensible en un `.age` avec une passphrase, je le déchiffre ailleurs, je
nettoie les EXIF d'une photo avant de l'envoyer, et le tout sans aucun binaire externe ni réseau.

---

## F22 · Partage LAN éphémère + QR

**L'idée.** Envoyer un fichier (ou un dossier) à un autre appareil — son téléphone, l'ordi d'un collègue sur
le même réseau — **sans cloud, sans câble, sans compte**. Vela lance un mini-serveur HTTP local le temps du
transfert et affiche un **QR code** : on le scanne avec le téléphone, on télécharge. C'est « AirDrop, mais
souverain et multiplateforme », et c'est bluffant en démo.

**Pour qui.** Tout le monde. Le « passe-moi ce fichier sur mon tel » quotidien.

**Comment ça vit dans Vela.**
- Clic droit sur un/des fichiers → **« Partager sur le réseau local »** → un panneau s'ouvre : URL
  (`http://192.168.x.x:PORT/...`) + **QR code** + minuteur. Le destinataire scanne, télécharge. Un dossier →
  servi en .zip à la volée.
- **Réception** aussi : « Recevoir un fichier » → page d'upload servie + QR → le téléphone envoie vers Vela.
- Sécurité : **token aléatoire** dans l'URL, **expiration** (temps ou après N téléchargements), bouton
  « Arrêter le partage ». Lié au réseau local uniquement (bind sur l'IP LAN, pas 0.0.0.0 exposé).
- **Palette** : « Partager sur le réseau local », « Recevoir un fichier ».

**Backend.**
- Mini-serveur **`axum`**/`tiny_http` (Rust) lancé à la demande, route unique tokenisée → stream du fichier
  (ou zip à la volée pour un dossier). QR via crate **`qrcode`** (pure Rust) → SVG/PNG affiché dans l'UI.
  Détection de l'IP LAN (`if-addrs`/`local-ip-address`). Arrêt = drop du serveur.
- Commandes : `share_start(paths) -> { url, qr }`, `share_stop`, `receive_start(destDir) -> { url, qr }`.

**Frontend.**
- `SharePanel.tsx` (URL + QR + minuteur + stop). `useShare`. Réutilise le navigateur intégré pour tester le
  lien si besoin.

**Dépendances.** `axum`/`tiny_http`, `qrcode`, `local-ip-address` (pures). Souveraineté ✅ totale.

**Effort.** M.

**Risques.** Sécurité réseau : bind LAN + token + expiration **obligatoires**, jamais d'exposition large.
Pare-feu local pouvant bloquer le port (message clair). Ne servir **que** ce qui est explicitement partagé.

**Fini quand.** Je fais clic droit sur une photo, « Partager sur le réseau local », je scanne le QR avec mon
téléphone, je télécharge — sans WhatsApp, sans câble, sans cloud, en 5 secondes.

---

## F23 · Règles d'automatisation (type Hazel)

**Le pari.** Définir des **règles** qui s'appliquent automatiquement à un dossier surveillé : « tout fichier
ajouté dans Téléchargements qui finit par `.pdf` et contient `facture` → déplace dans `Documents/Factures` et
tague en jaune ». C'est l'outil culte de macOS (Hazel) qui n'a pas d'équivalent libre soigné. Vela a déjà le
watcher (`notify`/`watch_dir`) et toutes les actions (déplacer, renommer, tagger, convertir) — il ne manque
que le moteur de règles qui les orchestre.

**Pour qui.** Power users, gens organisés, qui veulent que le rangement se fasse tout seul.

**Comment ça vit dans Vela.**
- Un éditeur de règles (overlay, accessible Réglages + palette « Règles d'automatisation ») : par règle, un
  **dossier surveillé**, des **conditions** (nom/extension/taille/date/contenu — réutilise les critères de
  F05) et des **actions** (déplacer, copier, renommer par motif, tagger, convertir, supprimer, chiffrer,
  exécuter une commande). Conditions combinables (ET/OU).
- Mode **« simulation »** : voir ce que la règle ferait sur l'état actuel **avant** de l'activer (filet de
  sécurité indispensable). Journal des actions effectuées (annulable tant que possible).
- Les règles tournent quand Vela est ouvert (watcher), avec un petit indicateur d'activité.
- **Réglages** : activer/désactiver globalement, gérer les règles.

**Backend.**
- Moteur `automation.rs` : règles persistées (`~/.config/vela/rules.json`), branché sur `DirWatcher`. À chaque
  event fs, évaluer les conditions, exécuter les actions (réutilise `ops`, `tags`, `convert`, F21…). Log des
  exécutions. Pur Rust.
- Commandes : `rules_list/save`, `rule_simulate(rule) -> [actions prévues]`.

**Frontend.**
- `RulesEditor.tsx` (réutilise les composants de critères de F05 et le rendu de plan d'actions de F20/tri).
  `useRules`.

**Dépendances.** Aucune (watcher + actions déjà là). Souveraineté ✅.

**Effort.** L (un moteur de règles fiable + la simulation demandent de la rigueur).

**Risques.** **Danger d'automatisation destructive** : simulation obligatoire avant activation, jamais de
suppression sans confirmation initiale, journal + undo autant que possible, boucles à éviter (une action qui
re-déclenche la règle). Démarrer prudent (déplacer/tagger), ajouter supprimer/chiffrer avec garde-fous.

**Fini quand.** Je crée « PDF contenant *facture* dans Téléchargements → Documents/Factures + tag jaune », je
la simule, je l'active, et mes factures se rangent toutes seules au fil de l'eau.

---

## F24 · Templates & espaces de travail

**L'idée.** Deux petits confforts à fort usage :
1. **Nouveau depuis template** : créer un fichier/dossier à partir d'un modèle (un `.gitignore` type, une
   structure de projet, une trame de document, un dossier-type de tournage). Clic droit → « Nouveau depuis
   modèle → … ».
2. **Espaces de travail** : sauver un **ensemble** d'onglets + profil + dossiers ouverts sous un nom
   (« Projet Vela », « Compta »), et le rouvrir d'un coup. Restaure le contexte de travail instantanément.

**Pour qui.** Tout le monde — surtout ceux qui jonglent entre plusieurs contextes (Chris, multi-projets).

**Comment ça vit dans Vela.**
- **Templates** : un dossier `~/.config/vela/templates/` ; chaque entrée (fichier ou arbo) devient une option
  dans « Nouveau depuis modèle ». L'utilisateur ajoute un modèle via « Enregistrer comme modèle » sur une
  sélection. Variables simples optionnelles (`{{date}}`, `{{nom}}`) substituées à la création.
- **Espaces de travail** : « Enregistrer l'espace de travail » capture les onglets (F02) + profil actif +
  dossiers. Rappelables depuis la sidebar (section « Espaces ») et la palette. Persistés
  `~/.config/vela/workspaces.json`.
- **Palette** : « Nouveau depuis modèle », « Ouvrir un espace de travail », « Enregistrer l'espace de travail ».

**Backend.**
- Templates : copie d'arbo (réutilise `copy_entries`) + substitution de variables (lecture/écriture simple).
  `template_list`, `template_instantiate(name, dest, vars)`.
- Espaces : pur état (onglets/profil/dossiers) sérialisé. S'appuie sur F02 (onglets) et `useProfiles`.

**Frontend.**
- `useTemplates`, `useWorkspaces` (CRUD + persistance, calqués sur `useFavorites`). Entrées sidebar + palette.

**Dépendances.** Aucune. Souveraineté ✅.

**Effort.** S (mais les espaces de travail supposent F02 fait).

**Risques.** Substitution de variables = garder ça minimal (pas un moteur de template complet). Restaurer un
espace dont un dossier n'existe plus → ignorer proprement avec un avertissement.

**Fini quand.** Je crée un nouveau projet depuis mon modèle « starter bun » en un clic, et je rouvre mon espace
« Projet Vela » (3 onglets + profil Édition) d'une seule commande après un redémarrage.
