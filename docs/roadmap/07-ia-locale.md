# Pilier 6 — IA locale souveraine

> Vela a déjà l'infra : EchoHub (LLM local, API Messages sur `127.0.0.1:37821`, câblé dans `nl.ts`), le
> control plane MCP, et le pattern venv optionnel (demucs). Ces deux features transforment cette infra en
> capacités concrètes pour l'utilisateur — sans jamais envoyer un octet hors de la machine. C'est le
> différenciateur le plus fort de Vela : un file manager qui **comprend** ses fichiers, en local.

---

## F19 · Transcription locale (Whisper)

**Le pari.** Transcrire automatiquement un fichier audio ou vidéo en texte, en local, via Whisper. Sortie
en texte brut ou en **sous-titres .srt/.vtt** horodatés. Et, une fois transcrit, on peut **chercher dans le
contenu parlé** d'une vidéo. Pour un chercheur (entretiens), un créateur (sous-titres), un étudiant (cours
enregistrés), c'est un gain de temps énorme — et payer un service en ligne pour ça est absurde quand ça
tourne sur la machine.

**Pour qui.** Chercheurs (interviews), créateurs (sous-titres), journalistes, étudiants.

**Décisions arrêtées (retour Chris).**
- Backend = **faster-whisper** (CTranslate2), pas whisper.cpp.
- **Cascade de device** : CUDA (NVIDIA) si dispo → AMD (ROCm) si reconnu → **CPU en dernier recours**.
  L'utilisateur peut **forcer CPU ou GPU** dans les Réglages (préférence, pas auto-imposée).
- **Modèle par défaut = `medium`.**
- **Aucun modèle installé par défaut** (poids). On télécharge à la demande seulement.
- Tout doit être **synchronisé avec les modèles déjà installés** : Réglages et palette ne proposent que ce
  qui est présent, et proposent l'**installation** dès qu'un paramètre choisi (modèle/device) manque un
  requirement.

> ⚠️ **Réserve technique à trancher.** CTranslate2 (le moteur de faster-whisper) supporte officiellement
> **CUDA + CPU**, mais **pas ROCm/AMD**. Sur GPU AMD, faster-whisper retombera donc en pratique sur le CPU.
> Un vrai chemin GPU-AMD imposerait un second backend (whisper.cpp Vulkan/ROCm). À décider : (a) AMD →
> fallback CPU assumé et documenté, ou (b) double backend faster-whisper (NVIDIA/CPU) + whisper.cpp (AMD).
> Sur la machine de Chris (RTX 3060) la question est théorique — CUDA est le chemin réel.

**Comment ça vit dans Vela.**
- Clic droit sur un fichier audio/vidéo → **« Transcrire… »** : langue (auto/forcée), **modèle** (liste
  synchronisée avec l'installé, `medium` par défaut), **device** (Auto/GPU/CPU selon préférence Réglages),
  format de sortie (txt / srt / vtt). Si le modèle/requirement choisi manque → **propose l'install** avant de
  lancer (job long + progression). Même logique depuis la **palette** « Transcrire… ».
- Résultat écrit à côté du fichier (`entretien.srt`) et ouvert dans l'éditeur. Pour une vidéo, on peut
  enchaîner sur F18 « brûler les sous-titres ».
- **Recherche dans le parlé** : une fois un dossier transcrit, son contenu audio devient cherchable (le .srt
  alimente la recherche contenu F05 / l'index sémantique F07). « Retrouve la vidéo où je parle de souveraineté ».
- **Réglages** : préférence device (Auto / GPU / CPU), modèle par défaut (`medium`), langue par défaut, liste
  des modèles installés (avec taille) + bouton installer/supprimer par modèle.
- **Synergie control plane** : `transcribe(path)` exposé au MCP → « transcris-moi cette réunion ».

**Backend.**
- Venv dédié `~/.local/share/vela/whisper-venv` (`faster-whisper`), pattern demucs (détection, install
  proposée, capabilities). Détection device : interroger CUDA (NVIDIA), puis ROCm (AMD), sinon CPU.
- Modèles stockés dans `~/.local/share/vela/whisper-models/` (ou cache HF). `transcribe_models()` liste
  l'installé → c'est la **source de vérité** pour synchroniser Réglages + palette + modale.
- Extraction audio préalable via ffmpeg (déjà là) pour les vidéos.
- Commandes : `transcribe_capabilities` (venv + devices dispo), `transcribe_models` (installés),
  `transcribe_install_model(name)` (job), `transcribe_start(path, {model, device, lang, format}) -> job`,
  segments → assemblage srt/vtt côté Rust.

**Frontend.**
- `useTranscribe` (capabilities + modèles installés + jobs, calqué sur `use-download`/stems).
  `TranscribeModal.tsx` (synchro modèles installés, propose install si manquant). Section Réglages dédiée.

**Dépendances.** venv faster-whisper + modèle(s) (opt-in, install à la demande, rien par défaut) ; ffmpeg
(présent). Souveraineté ◑ (local, mais venv/modèle à installer). Dégradation : venv absent → entrée masquée +
proposition d'install.

**Effort.** L.

**Risques.** Poids des modèles (`medium` ≈ 1,5 Go) → **jamais installé d'office**, toujours à la demande avec
taille affichée. Désync Réglages/installé → la liste vient **toujours** de `transcribe_models`, jamais en dur.
AMD : cf. réserve technique ci-dessus. Temps de transcription long → job background, jamais bloquant.

**Fini quand.** Je fais clic droit sur une interview d'une heure, le modèle `medium` est proposé par défaut
(ou son install si absent), je lance sur GPU (CUDA), et j'obtiens un .srt horodaté correct ; plus tard je
retrouve cette vidéo en cherchant un mot que j'y ai prononcé. Changer le device/modèle dans les Réglages se
reflète immédiatement dans la modale et la palette.

---

## F20 · Actions IA sur fichiers (renommage, résumé, tags)

**L'idée.** Un petit ensemble d'actions IA locales qui répondent à des corvées universelles, branchées sur
EchoHub (texte) et un VLM local type Qwen2.5-VL (image) :
- **Renommage intelligent** : suggérer un nom de fichier clair à partir du **contenu** (un PDF `scan_001.pdf`
  → `facture-EDF-2026-03.pdf`, une photo → `coucher-soleil-plage.jpg`).
- **Résumé de document** : TL;DR d'un PDF/txt/md long, affiché via `preview_content` ou en sidecar `.summary.md`.
- **Tags / description d'images** (VLM) : générer des mots-clés et un **alt-text** (accessibilité) pour une
  image, stockés en métadonnées/tags.
- **Tri automatique par intention** : « range ce dossier de téléchargements » → l'IA propose un classement
  (factures, images, installeurs…) que l'utilisateur **valide avant** application (jamais automatique).

**Pour qui.** Tout le monde — ce sont des corvées que personne n'aime.

**Comment ça vit dans Vela.**
- Toujours en **clic droit contextuel** (le menu s'adapte : sur un PDF « Résumer / Renommer intelligemment » ;
  sur une image « Décrire / Taguer ») et en **palette**.
- **Toujours une étape de validation** : l'IA *propose*, l'utilisateur *confirme*. Un renommage suggéré est
  pré-rempli dans la modale de rename habituelle ; un tri proposé est montré comme un plan avant exécution
  (annulable `Ctrl+Z`).
- **Opt-in global** dans les Réglages (« Activer les actions IA locales ») — **désactivé par défaut** (retour
  Chris), comme la palette NL. Indique le modèle/endpoint utilisé (EchoHub).
- **Aucun modèle téléchargé d'office** (retour Chris) : on s'appuie sur EchoHub qui gère ses modèles à la
  demande. Si EchoHub n'a pas de modèle chargé/installé, on **propose** le chargement/install, on ne l'impose
  jamais. Toute la suite IA reste synchronisée avec ce qui est réellement disponible (via `echohub_status`).

**Backend.**
- Texte : réutilise le pont EchoHub (`nl.ts` montre déjà l'API Messages locale). Extraction de texte = pandoc/
  pdftotext (déjà dans l'orbite). Prompts structurés (sortie JSON pour les noms/tags — cf. skill
  structured-output, Outlines/grammars côté EchoHub).
- Image : VLM via EchoHub (Qwen2.5-VL) → description/tags. `ai_describe_image`, `ai_suggest_name`,
  `ai_summarize`, `ai_classify_dir`.

**Frontend.**
- `useAiActions` (gated par le réglage opt-in + capabilities EchoHub via `echohub_status`). Branchements dans
  `ContextMenus` (selon `previewKind`) et `useCommandRegistry`. Réutilise la modale rename pour le nom suggéré.

**Dépendances.** EchoHub chargé (LLM + VLM local). Dégradation : EchoHub absent/déchargé → actions grisées
avec tooltip « démarre EchoHub ». Souveraineté ◑ (local).

**Effort.** M (l'infra existe ; le travail est UX + prompts robustes + validation).

**Risques.** Sortie LLM imprévisible → **toujours** sortie structurée + validation humaine, jamais d'action
destructive directe. Coût/latence → traiter à la demande, pas en masse silencieuse. Ne pas sur-promettre : ce
sont des *suggestions*.

**Fini quand.** Je fais clic droit sur `scan_042.pdf`, « Renommer intelligemment », et la modale me propose
`facture-internet-mars-2026.pdf` que je valide d'un Entrée ; je « décris » une photo et j'obtiens un alt-text
correct stocké dans ses tags.
