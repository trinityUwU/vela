# Pilier 5 — Audio & vidéo

> Ambition : **GarageBand, pas Pro Tools**. Vela fait déjà du non-destructif audio (trim/fade/normalize/
> convert/remove-vocals/stems) et vidéo (trim/convert/extract). On ajoute ce qui manque pour boucler un
> usage créatif léger : capter, visualiser, retoucher des métadonnées, fabriquer des GIF, brûler des
> sous-titres. Toujours « ouvre → paramètre → exporte », jamais de timeline multipiste.

---

## F17 · Studio audio : enregistreur + waveform visuel + tags

**L'idée.** Trois ajouts qui transforment la suite audio en mini-studio :
1. **Enregistreur micro** → fichier (voix, mémo, podcast brut).
2. **Éditeur waveform visuel** : voir la forme d'onde et **couper/sélectionner à la souris** au lieu de taper
   des timestamps, poser des **marqueurs**, **concaténer** plusieurs fichiers, changer **vitesse/pitch**,
   **découper automatiquement sur les silences** (génial pour dégrossir un enregistrement).
3. **Éditeur de tags ID3 / cover** : titre, artiste, album, année, pochette.

**Pour qui.** Podcasteurs, musiciens amateurs, créateurs de contenu, preneurs de mémos.

**Comment ça vit dans Vela.**
- **Enregistreur** : palette « Enregistrer un son » → petit panneau (niveau d'entrée, sélection du
  périphérique, rec/stop) → écrit un `.wav`/`.flac` dans le dossier courant. Indicateur de niveau live.
- **Waveform** : pour un fichier audio ouvert dans les outils audio, un ruban de forme d'onde (on a déjà
  `audio-viz.ts` + spectrum-analyzer). Sélection à la souris = la plage de découpe ; marqueurs cliquables ;
  bouton « Découper sur les silences » (seuil réglable) → segments exportables.
- **Tags** : section « Métadonnées » dans les outils audio (édition + drag d'une image comme pochette).
- **Réglages** : périphérique d'entrée par défaut, format d'enregistrement.

**Backend.**
- Enregistrement : crate **`cpal`** (capture audio multiplateforme, pure Rust) → flux PCM → encodage via
  ffmpeg/`hound` (wav). Commande `audio_record_start/stop` (pattern jobs).
- Waveform : extraction des pics (downsample du PCM via ffmpeg ou décodage `symphonia` pur Rust) →
  `audio_waveform(path) -> [peaks]`. Détection de silence : analyse RMS par fenêtre (maison ou
  `ffmpeg silencedetect`).
- Vitesse/pitch, concat : ffmpeg (`atempo`, `rubberband` si dispo, `concat`). `audio_concat`, `audio_tempo`.
- Tags : crate **`lofty`** (lecture/écriture ID3/Vorbis/MP4, pure Rust, multi-format) → `audio_read_tags`,
  `audio_write_tags`.

**Frontend.**
- `AudioRecorder.tsx`, extension de `AudioToolsPanel` pour la waveform interactive (sélection/ marqueurs) et
  la section tags. Réutilise `audio-viz.ts`.

**Dépendances.** `cpal`, `symphonia`/`hound`, `lofty` (pures) ; ffmpeg (déjà là) pour tempo/concat ;
rubberband optionnel (pitch de qualité). Souveraineté ◑ (cœur pur, ffmpeg déjà présent).

**Effort.** L (l'enregistreur + waveform interactive sont les morceaux conséquents).

**Risques.** Latence/permissions micro selon le système. Waveform sur fichier long → calculer les pics en
background + cache. Rester non-destructif (toujours exporter, ne pas réécrire l'original).

**Fini quand.** J'enregistre un mémo au micro, je vois sa waveform, je coupe le blanc du début à la souris, je
découpe sur les silences pour virer les hésitations, et j'écris le titre + la pochette dans les tags.

---

## F18 · Boîte à outils vidéo étendue + aperçu au survol

**L'idée.** Compléter la suite vidéo avec les opérations « grand public » qui manquent, et ajouter un confort
de navigation très apprécié : **l'aperçu au survol** (scrub des vignettes en passant la souris sur une vidéo
dans la grille, comme macOS / YouTube).

**Pour qui.** Créateurs de contenu, monteurs occasionnels, tout le monde qui a un dossier de vidéos.

**Comment ça vit dans Vela.**
- Clic droit sur une vidéo → outils vidéo enrichis :
  - **Vidéo → GIF** (plage + fps + largeur, estimation de taille).
  - **Concaténer** plusieurs vidéos (réordonnables à la souris).
  - **Brûler des sous-titres** (.srt → incrustés) ou les **incruster en piste** (soft sub).
  - **Filigrane** (texte/image, position).
  - **Compresser** avec **estimation de taille cible** (« vise 25 Mo » → calcule le bitrate). Existe en CRF,
    on ajoute le mode « taille cible ».
  - **Rotation**, **extraire un storyboard** (planche de N vignettes régulières).
- **Aperçu au survol** dans la grille : survoler une vidéo fait défiler 5–10 vignettes (scrub). Les vignettes
  sont générées paresseusement et mises en cache.
- **Palette** : « Vidéo en GIF », « Concaténer des vidéos », etc.

**Backend.**
- Tout via **ffmpeg** (déjà présent, `video.rs`) : `palettegen`/`paletteuse` pour des GIF propres, filtre
  `subtitles`, `drawtext`/`overlay` pour le filigrane, `concat`, calcul de bitrate pour la taille cible.
- Vignettes de survol : `video_storyboard(path, n) -> [thumb paths]` (ffmpeg `-vf fps`), cache dans
  `~/.cache/vela/` (réutilise l'esprit de `thumbs.rs`).
- Commandes : `video_to_gif`, `video_concat`, `video_subtitles`, `video_watermark`, `video_target_size`,
  `video_storyboard`. Toutes en job long + progress + cancel (pattern existant).

**Frontend.**
- Extension de `VideoToolsPanel`. `useHoverPreview` (génère/lit le storyboard au survol, débounce). Affichage
  dans `FileTile`/`FileGrid` (overlay de la vignette courante au survol).

**Dépendances.** ffmpeg (déjà géré, optionnel). Souveraineté ◑.

**Effort.** M.

**Risques.** Génération de storyboard coûteuse → strictement paresseuse (au survol, pas au listing) + cache +
annulation si la souris quitte. GIF de longue plage = énorme → cap + avertissement de taille.

**Fini quand.** Je survole une vidéo et je vois son contenu défiler ; je transforme un extrait en GIF de 3 Mo ;
je brûle un .srt dans une vidéo ; je compresse une capture pour qu'elle tienne sous 25 Mo — tout dans Vela.
