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

**Comment ça vit dans Vela.**
- Clic droit sur un fichier audio/vidéo → **« Transcrire… »** : choix de la langue (auto/forcée), du modèle
  (tiny/base/small/medium selon la machine), du format de sortie (txt / srt / vtt). Job long + progression.
- Résultat écrit à côté du fichier (`entretien.srt`) et ouvert dans l'éditeur. Pour une vidéo, on peut
  enchaîner sur F18 « brûler les sous-titres ».
- **Recherche dans le parlé** : une fois un dossier transcrit, son contenu audio devient cherchable (le .srt
  alimente la recherche contenu F05 / l'index sémantique F07). « Retrouve la vidéo où je parle de souveraineté ».
- **Réglages** : modèle Whisper par défaut, langue par défaut, GPU on/off.
- **Synergie control plane** : `transcribe(path)` exposé au MCP → « transcris-moi cette réunion ».

**Backend.**
- **`whisper.cpp`** (binaire ggml, CPU/GPU, léger, souverain) **ou** un venv `faster-whisper`
  (`~/.local/share/vela/whisper-venv`) — même pattern que demucs (détection, install proposée, capabilities).
  whisper.cpp est préférable (pas de venv Python lourd, modèles ggml quantifiés, marche sur la RTX 3060).
- Extraction audio préalable via ffmpeg (déjà là) pour les vidéos.
- Commandes : `transcribe_capabilities`, `transcribe_install`, `transcribe_start(path, opts) -> job`,
  segments → assemblage srt/vtt côté Rust.

**Frontend.**
- `useTranscribe` (capabilities + jobs, calqué sur `use-download`/stems). `TranscribeModal.tsx`.

**Dépendances.** whisper.cpp + modèle (opt-in, install proposée) ; ffmpeg (présent). Souveraineté ◑ (local,
mais binaire/modèle à installer). Dégradation : absent → entrée masquée + proposition d'install.

**Effort.** L.

**Risques.** Premier téléchargement de modèle (de ~75 Mo tiny à ~1,5 Go medium) → opt-in clair, choix de
taille selon la machine. Temps de transcription long → job background, jamais bloquant. Qualité variable
selon langue/modèle → laisser le choix du modèle.

**Fini quand.** Je fais clic droit sur une interview d'une heure, je choisis « small, français, srt », et
j'obtiens un .srt horodaté correct ; plus tard je retrouve cette vidéo en cherchant un mot que j'y ai prononcé.

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
- **Opt-in global** dans les Réglages (« Activer les actions IA locales ») — désactivé par défaut, comme la
  palette NL. Indique le modèle/endpoint utilisé (EchoHub).

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
