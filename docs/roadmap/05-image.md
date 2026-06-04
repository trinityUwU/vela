# Pilier 4 — Image

> Vela retouche déjà une image (crop/rotate/resize/ajustements). Cette vague couvre le **parcours autour**
> de l'image : la regarder confortablement, en traiter beaucoup d'un coup, et annoter une capture. On reste
> loin de Photoshop — on vise « l'outil qui évite d'ouvrir Photoshop pour rien ».

---

## F14 · Galerie / lightbox + EXIF + extraction de palette

**Le manque.** Regarder ses images dans Vela est aujourd'hui poussif : on ouvre fichier par fichier. Il
manque une **visionneuse plein écran** avec navigation au clavier, zoom, et les **métadonnées EXIF** (appareil,
date, GPS, ISO…). Plus un bonus très demandé par les créa : **extraire la palette de couleurs** d'une image
et **piocher une couleur** (pipette) avec copie du hex.

**Pour qui.** Photographes, créatifs, designers, tout le monde qui trie des photos.

**Comment ça vit dans Vela.**
- Double-clic sur une image (ou `Espace` / QuickLook) → **lightbox** : image centrée, fond sombre, **←/→**
  pour naviguer dans les images du dossier, **molette/`+`/`-`** zoom, **glisser** pour déplacer, `F` plein
  écran, `Échap` ferme. Bandeau de **vignettes** en bas (film strip).
- Volet **infos** repliable : EXIF (appareil, objectif, date, expo, ISO, dimensions, taille, GPS → lien carte
  via le navigateur intégré), histogramme simple.
- **Pipette** : clic sur l'image → hex copié. **Palette** : bouton « Extraire la palette » → 5–8 couleurs
  dominantes, chacune copiable.
- **Palette commandes** : « Ouvrir la galerie », « Extraire la palette de couleurs ».

**Backend.**
- EXIF : crate **`kamadak-exif`** (pure Rust). `image_exif(path) -> map`.
- Palette : crate **`color-thief`** ou quantification maison sur la miniature (déjà générée par `thumbs.rs`).
  `image_palette(path, n) -> [hex]`. Pure Rust.
- Le rendu/zoom est front (le décodage passe par le `<img>` + asset protocol déjà utilisé pour les previews).

**Frontend.**
- `Lightbox.tsx` (overlay plein écran, film strip, zoom/pan — Framer Motion pour les transitions, conforme
  aux defaults). `ExifPanel.tsx`. Pipette via `<canvas>` (lire le pixel sous le curseur).

**Dépendances.** `kamadak-exif`, `color-thief` (pures). Souveraineté ✅.

**Effort.** M.

**Risques.** Très grandes images (50 Mpx) → afficher la miniature/version downscalée d'abord, charger la
pleine def à la demande. Formats RAW (CR2/NEF) → hors scope initial (signaler), ou via `image` si supporté.

**Fini quand.** Je parcours 300 photos aux flèches en plein écran avec leur date/appareil affichés, je zoome
sur un détail, et j'extrais la palette d'une affiche pour copier un hex.

---

## F15 · Optimisation & conversion d'images par lot

**Le manque.** Convertir/compresser **une** image existe ; le faire sur **un dossier entier** non. Or c'est
le besoin réel : « réduis-moi ces 80 photos pour le web », « convertis tout en WebP », « enlève les EXIF
avant de publier » (vie privée). C'est un gain de temps massif et une carte « souveraineté » (les gens
uploadent leurs photos sur des compresseurs en ligne).

**Pour qui.** Web/créa, blogueurs, quiconque envoie des images, soucieux de vie privée.

**Comment ça vit dans Vela.**
- Sélection multiple d'images → clic droit → **« Traiter par lot… »** : une modale avec
  **redimensionner** (max largeur/hauteur, %), **convertir** (png/jpg/webp/avif + qualité), **compresser**
  (optimiseur), **strip EXIF** (case « retirer les métadonnées », cochée par défaut pour la confidentialité),
  **renommer** (motif `photo_###`). Aperçu du **gain de poids estimé** (« 240 Mo → ~58 Mo »).
- Sortie : nouveau dossier `optimized/` ou suffixe, **jamais en écrasant** (non-destructif). Job long +
  progression + annulation.
- **Palette** : « Optimiser des images par lot ».

**Backend.**
- Réutilise/étend `imaging.rs` (crate `image` déjà là) pour resize/convert/strip. Optimiseurs dédiés en
  **option** pour la qualité de compression : **`oxipng`** (PNG, crate pure !), **mozjpeg** (JPEG), webp/avif
  via `image` ou `ravif`/`libwebp`. Capabilities → l'option fine apparaît si dispo, sinon compression `image`
  standard.
- Commande `images_batch(paths, ops) -> job`. Strip EXIF = ré-encodage sans copier le bloc de métadonnées.

**Frontend.**
- `ImageBatch.tsx` (modale, réutilise `audio-tools-ui`/`ImageToolsPanel` pour les contrôles). Estimation de
  poids = échantillon sur 1-2 fichiers extrapolé, ou réel en streaming.

**Dépendances.** `image` (présent), `oxipng` (crate pure) ; mozjpeg/avif optionnels. Souveraineté ✅ (cœur pur).

**Effort.** M.

**Risques.** AVIF/WebP encodage = lent → job background obligatoire, prévenir. Préserver l'orientation EXIF
**avant** de la stripper (sinon rotation perdue) — appliquer l'orientation puis retirer le tag.

**Fini quand.** Je sélectionne 80 photos, « max 1920px, WebP qualité 80, retirer EXIF », et j'obtiens un
dossier `optimized/` 4× plus léger, sans métadonnées GPS, sans rien uploader.

---

## F16 · Annotation de captures d'écran

**L'idée.** Annoter rapidement une image — surtout une capture d'écran : **flèches, rectangles, texte,
surlignage, numéros d'étape, et flou pour masquer une info sensible** (token, email, visage). C'est le geste
quotidien de tout dev/support/PM qui partage un screenshot. Aucun file manager ne le fait, et c'est exactement
dans l'esprit « petit outil ultra pratique ».

**Pour qui.** Développeurs, support, PM, toute personne qui partage des captures.

**Comment ça vit dans Vela.**
- Sur une image → **« Annoter »** : ouvre l'image dans un **canvas d'annotation** (dans le viewer, docké,
  comme les outils image existants). Outils : flèche, rectangle/ellipse, ligne, **texte**, **surligneur**,
  **flou/pixellisation de zone**, **numéro d'étape** (1,2,3… auto-incrémenté), crayon libre. Couleur +
  épaisseur. `Ctrl+Z` annule le dernier trait.
- Export non-destructif → `image_annotated.png`, ou **copie dans le presse-papier** directement (workflow
  capture → annote → colle dans un chat).
- **Palette** : « Annoter une image ».

**Backend.**
- Quasi tout est front (canvas). Export = rasterisation du canvas → `write_file` (base64) via une commande
  ou l'API navigateur. Le flou applique un filtre sur la région (canvas) avant export.
- Optionnel : commande `clipboard_set_image(bytes)` (coller l'annotation ailleurs) — petite commande Rust
  (crate `arboard`, image clipboard).

**Frontend.**
- `ImageAnnotate.tsx` : surcouche `<canvas>` au-dessus de l'image (calque d'objets vectoriels édités, rendus
  à l'export). Modèle d'objets simple (type, coords, style) → annule/refait facile. Réutilise le dock de
  l'`ImageToolsPanel` pour la barre d'outils.

**Dépendances.** `arboard` (clipboard image, optionnel). Cœur = front. Souveraineté ✅.

**Effort.** M.

**Risques.** Le flou doit être **destructif à l'export** (réellement illisible), pas un simple overlay qu'on
peut retirer du PNG — appliquer le pixel-blur sur la région source au moment du rendu final. Important pour
la confidentialité.

**Fini quand.** Je prends une capture, je l'ouvre dans Vela, je mets deux flèches rouges, un numéro, je floute
un token, et je colle le résultat directement dans Discord — sans Greenshot ni site en ligne.
