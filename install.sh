#!/usr/bin/env bash
# Build release Tauri + installe le binaire autonome dans ~/.local/bin/vela-bin.
# IMPORTANT : ne JAMAIS faire `pkill -f vela-bin` — le motif matche la ligne de
# commande du script lui-même et le tue avant le cp. Toujours `pkill -x vela-bin`
# (match exact sur le nom de process). Ce bug nous a coûté 1h le 2026-06-02.
set -euo pipefail
cd "$(dirname "$0")"

BIN_SRC="src-tauri/target/release/vela"
BIN_DST="$HOME/.local/bin/vela-bin"

echo "→ build release (bunx tauri build)…"
bunx tauri build

[ -f "$BIN_SRC" ] || { echo "✗ binaire introuvable : $BIN_SRC"; exit 1; }

# Arrêt de l'instance en cours par nom EXACT (jamais -f).
pkill -x vela-bin 2>/dev/null && echo "→ instance précédente arrêtée" || true
sleep 0.3

cp -f "$BIN_SRC" "$BIN_DST"
echo "✓ installé : $BIN_DST ($(stat -c '%y' "$BIN_DST"))"

# Smoke test : lance, vérifie que le process tient, puis arrête.
WEBKIT_DISABLE_DMABUF_RENDERER=1 "$BIN_DST" >/tmp/vela-smoke.log 2>&1 &
sleep 3
if pgrep -x vela-bin >/dev/null; then
  echo "✓ smoke test : RUNNING"
  pkill -x vela-bin 2>/dev/null || true
else
  echo "✗ smoke test : CRASH — voir /tmp/vela-smoke.log"
  cat /tmp/vela-smoke.log
  exit 1
fi

# ── Séparation de stems (demucs) — automatique, idempotent, non bloquant ────
# Installe demucs + torchcodec dans un venv Vela dédié (séparation voix/instru,
# 100% local, tourne sur GPU si CUDA dispo). torch ~3 Go au premier run.
# torchcodec requis : torchaudio récent délègue l'écriture audio à TorchCodec.
# Opt-out : VELA_SKIP_STEMS=1 ./install.sh  ·  Vela fonctionne sans (feature "non installée").
DEMUCS_VENV="$HOME/.local/share/vela/demucs-venv"
if [ "${VELA_SKIP_STEMS:-0}" = "1" ]; then
  echo "→ demucs ignoré (VELA_SKIP_STEMS=1)"
elif [ -x "$DEMUCS_VENV/bin/demucs" ]; then
  echo "✓ demucs déjà présent : $DEMUCS_VENV"
elif ! command -v python3 >/dev/null; then
  echo "⚠ python3 absent — séparation de stems non installée (à faire depuis l'app plus tard)"
else
  echo "→ installation de demucs (séparation de stems, torch ~3 Go au 1er run)…"
  if python3 -m venv "$DEMUCS_VENV" \
     && "$DEMUCS_VENV/bin/pip" install -q --upgrade pip \
     && "$DEMUCS_VENV/bin/pip" install -q demucs torchcodec; then
    echo "✓ demucs installé : $DEMUCS_VENV/bin/demucs"
  else
    echo "⚠ install demucs échouée — Vela fonctionne ; réessaie via Outils audio → Installer demucs"
  fi
fi

# ── Outils de téléchargement (yt-dlp + spotdl) — automatique, idempotent ─────
# yt-dlp = moteur de téléchargement core (non optionnel). spotdl = couche Spotify.
# Venv Vela dédié. Non bloquant : un échec n'interrompt pas l'install.
DL_VENV="$HOME/.local/share/vela/dl-venv"
if [ -x "$DL_VENV/bin/yt-dlp" ]; then
  echo "✓ yt-dlp déjà présent : $DL_VENV"
elif ! command -v python3 >/dev/null; then
  echo "⚠ python3 absent — yt-dlp/spotdl non installés (à faire plus tard)"
else
  echo "→ installation de yt-dlp + spotdl (outils de téléchargement)…"
  if python3 -m venv "$DL_VENV" \
     && "$DL_VENV/bin/pip" install -q --upgrade pip \
     && "$DL_VENV/bin/pip" install -q yt-dlp spotdl; then
    echo "✓ yt-dlp + spotdl installés : $DL_VENV"
  else
    echo "⚠ install yt-dlp/spotdl échouée — Vela fonctionne ; réessaie plus tard"
  fi
fi

# ── Traduction locale (Argos Translate) — automatique, idempotent, non bloquant ──────────────
# Venv Vela dédié. Traduction 100% offline après téléchargement des paquets de langue (à la demande
# depuis l'app). Installe en plus les paires fr<->en par défaut pour un usage immédiat.
TR_VENV="$HOME/.local/share/vela/translate-venv"
if [ -x "$TR_VENV/bin/python" ] && "$TR_VENV/bin/python" -c "import argostranslate" 2>/dev/null; then
  echo "✓ Argos Translate déjà présent : $TR_VENV"
elif ! command -v python3 >/dev/null; then
  echo "⚠ python3 absent — traduction non installée (à faire plus tard)"
else
  echo "→ installation d'Argos Translate (traduction locale)…"
  if python3 -m venv "$TR_VENV" \
     && "$TR_VENV/bin/pip" install -q --upgrade pip \
     && "$TR_VENV/bin/pip" install -q argostranslate; then
    echo "✓ Argos Translate installé : $TR_VENV"
    # Paires fr<->en par défaut (non bloquant : nécessite le réseau une fois).
    "$TR_VENV/bin/python" -c "import argostranslate.package as p; p.update_package_index(); av=p.get_available_packages(); [p.install_from_path(x.download()) for x in av if (x.from_code,x.to_code) in [('en','fr'),('fr','en')]]" 2>/dev/null \
      && echo "✓ paires fr<->en installées" || echo "⚠ paquets fr/en non téléchargés (réseau ?) — installables depuis l'app"
  else
    echo "⚠ install Argos échouée — Vela fonctionne ; réessaie plus tard"
  fi
fi

# ── Stack OCR (tesseract + langues + poppler) — auto-install, idempotent, non bloquant ───────
# Paquets système : nécessite sudo. --needed = idempotent. Un échec n'interrompt pas l'install.
echo ""
OCR_PKGS="tesseract tesseract-data-fra tesseract-data-eng poppler"
if command -v tesseract >/dev/null 2>&1 && command -v pdftoppm >/dev/null 2>&1; then
  echo "✓ OCR déjà disponible (tesseract + poppler)"
elif command -v pacman >/dev/null 2>&1; then
  echo "→ installation de la stack OCR ($OCR_PKGS)…"
  # -Sy avant -S : rafraîchit le DB local sinon 404 sur miroirs si la base est périmée.
  if sudo pacman -Sy --needed --noconfirm $OCR_PKGS; then
    echo "✓ OCR installé"
  else
    echo "⚠ install OCR échouée — base de paquets périmée ? lance « sudo pacman -Syu » puis relance ./install.sh"
  fi
else
  echo "○ pacman absent — pour l'OCR : installe $OCR_PKGS avec ton gestionnaire de paquets"
fi

# ── Conversion documents (pandoc + typst) — auto-install, idempotent, non bloquant ────────────
# pandoc = md/html/docx/odt/epub ; typst = moteur PDF léger et souverain (pandoc l'utilise pour →PDF).
# Tous deux légers et en dépôt officiel → installés d'office pour que l'export markdown→PDF marche
# dès une clean install (stabilité Vela). libreoffice (bureautique →PDF, ~1 Go) reste optionnel.
echo ""
DOC_PKGS="pandoc typst"
if command -v pandoc >/dev/null 2>&1 && command -v typst >/dev/null 2>&1; then
  echo "✓ conversion docs déjà disponible (pandoc + typst)"
elif command -v pacman >/dev/null 2>&1; then
  echo "→ installation de la conversion docs ($DOC_PKGS)…"
  if sudo pacman -Sy --needed --noconfirm $DOC_PKGS; then
    echo "✓ pandoc + typst installés (export markdown→PDF opérationnel)"
  else
    echo "⚠ install pandoc/typst échouée — lance « sudo pacman -Syu » puis relance ./install.sh"
  fi
else
  echo "○ pacman absent — pour l'export PDF : installe $DOC_PKGS avec ton gestionnaire de paquets"
fi
command -v libreoffice >/dev/null 2>&1 || command -v soffice >/dev/null 2>&1 \
  && echo "✓ libreoffice présent (bureautique →PDF)" \
  || echo "○ libreoffice absent (docx/odt →PDF, ~1 Go, optionnel)  →  sudo pacman -Syu --needed libreoffice-fresh"

# ── Compression (7z, rar) — signalé, pas auto-installé ────────────────────────────────────────
# p7zip = formats 7z/zip chiffrés (compression + extraction) ; rar = format RAR (non libre, AUR).
command -v 7z >/dev/null 2>&1 && echo "✓ 7z présent" || echo "○ 7z absent (compression 7z/zip chiffré)  →  sudo pacman -Syu --needed p7zip"
command -v rar >/dev/null 2>&1 && echo "✓ rar présent" || echo "○ rar absent (compression RAR)  →  yay -S rar  (AUR, non libre)"
