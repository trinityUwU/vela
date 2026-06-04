# Pilier 3 — Documents & texte

> Le bureau « papier » : PDF et Markdown. Deux outils qui couvrent une part énorme du quotidien de
> n'importe quel utilisateur (et de Chris), sans rien installer de lourd.

---

## F12 · Boîte à outils PDF

**Le manque.** Manipuler un PDF est un besoin universel — fusionner deux documents, extraire des pages,
faire pivoter un scan, compresser un fichier trop lourd pour un mail, ajouter un filigrane. Aujourd'hui tout
le monde passe par des sites en ligne douteux (on y dépose des documents souvent sensibles). Le faire en
local dans Vela est à la fois ultra utile **et** une vraie position de souveraineté.

**Pour qui.** Absolument tout le monde. Bureautique, admin, juridique, étudiants.

**Comment ça vit dans Vela.**
- Clic droit sur un/des PDF → **« Outils PDF »** → menu d'actions selon la sélection :
  - 1 PDF : **extraire des pages** (sélecteur de plage `1-3,7,10-`), **pivoter**, **compresser** (qualité
    basse/moyenne/haute avec estimation de taille), **filigrane** (texte ou image), **PDF → images**,
    **protéger par mot de passe** / retirer la protection.
  - Plusieurs PDF : **fusionner** (avec réordonnancement par glisser-déposer dans la modale).
  - Images sélectionnées → **images → PDF** (existe déjà via `images_to_pdf`, on l'unifie ici).
- Une **modale PDF** légère avec aperçu des pages (vignettes) pour extraire/réordonner visuellement.
- **Palette** : « Fusionner des PDF », « Compresser un PDF », etc.

**Backend.**
- Cœur en **crate Rust pure `lopdf`** (lecture/écriture/merge/extraction/rotation/pages → images) → zéro
  dépendance système pour le gros des opérations. Souveraineté ✅ sur le chemin principal.
- **Compression** et rendu vignettes fiables : `pdfium` (binaire) ou `ghostscript` en **option** (capabilities)
  pour le ré-échantillonnage d'images embarquées ; sans eux, compression « légère » (dédup/flate) via lopdf.
- Chiffrement : lopdf gère le RC4/AES standard PDF.
- Commandes : `pdf_merge`, `pdf_extract_pages`, `pdf_rotate`, `pdf_compress`, `pdf_watermark`,
  `pdf_to_images`, `pdf_protect` / `pdf_unprotect`. Opérations longues = job + progress.

**Frontend.**
- `PdfTools.tsx` (modale, vignettes via le `PdfViewer` existant). Routage depuis le menu contextuel selon
  `previewKind === "pdf"` et le nombre de fichiers (réutilise le pattern des smart-actions).

**Dépendances.** `lopdf` (pure) pour la base ; `ghostscript`/`pdfium` optionnels pour la compression poussée.
Souveraineté ◑ (cœur pur, compression avancée optionnelle).

**Effort.** M.

**Risques.** PDF malformés (lopdf peut buter) → try/catch + message clair. Compression sans ghostscript =
gains modestes, le dire honnêtement dans l'UI (« compression légère, installe ghostscript pour plus »).

**Fini quand.** Je fusionne 3 PDF en réordonnant à la souris, j'extrais les pages 2-5 d'un autre, je compresse
un scan de 40 Mo pour le mettre en pièce jointe — sans quitter Vela ni uploader nulle part.

---

## F13 · Markdown studio

**Le manque.** Vela rend déjà un aperçu Markdown, mais l'expérience d'écriture est pauvre : pas de preview
**live côte à côte**, pas de table des matières, pas d'export propre, pas de statistiques. Or Chris (et plein
de gens) écrivent en Markdown en permanence (STATE.md, docs, notes). En faire un vrai petit studio coûte peu
et sert tous les jours.

**Pour qui.** Rédacteurs, développeurs (docs/README), preneurs de notes.

**Comment ça vit dans Vela.**
- Pour un `.md` ouvert dans l'éditeur, un mode **split live** : éditeur à gauche, rendu synchronisé à droite
  (scroll lié). Toggle dans la barre de l'éditeur (3 états : code seul / split / preview seule).
- **Table des matières** repliable générée des titres (clic → saut). **Stats** en barre d'état : nombre de
  mots, caractères, temps de lecture estimé.
- **Export** : « Exporter en PDF / HTML » via la conversion déjà présente (pandoc / **typst** est installé,
  excellent pour un beau PDF / libreoffice). Réutilise `convert.rs`.
- Confort d'écriture Markdown : raccourcis `Ctrl+B`/`Ctrl+I`, transformation de liste, collage d'un lien sur
  une sélection → `[texte](url)`, collage d'image → copie dans un dossier `assets/` + insertion du lien.
- **Palette** : « Aperçu Markdown côte à côte », « Exporter en PDF ».

**Backend.**
- Rien de neuf pour la preview (front, `react-markdown` déjà là). Export = `convert_file` existant
  (md → pdf/html via pandoc/typst/libreoffice selon capabilities).
- Collage d'image : `write_file` base64 → `assets/`.

**Frontend.**
- Évolution de `EditorArea`/`Editor` : mode split (le composant de preview markdown existe déjà). `Toc.tsx`.
  Stats dans la `StatusBar` (F04). Raccourcis d'édition markdown dans la config CodeMirror.

**Dépendances.** pandoc/typst/libreoffice (déjà gérés par install.sh, optionnels). Souveraineté ◑.

**Effort.** M.

**Risques.** Synchronisation de scroll éditeur↔preview (approximation par ratio suffit, ne pas sur-ingénierer).
Gros documents → debounce du rendu.

**Fini quand.** J'écris un STATE.md en voyant le rendu en direct à droite, je navigue par la TOC, je vois
« 1 240 mots · 6 min », et j'exporte un PDF propre via typst en un clic.
