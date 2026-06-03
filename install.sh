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

# ── Stack OCR (tesseract + langues + poppler) — auto-install, idempotent, non bloquant ───────
# Paquets système : nécessite sudo. --needed = idempotent. Un échec n'interrompt pas l'install.
echo ""
OCR_PKGS="tesseract tesseract-data-fra tesseract-data-eng poppler"
if command -v tesseract >/dev/null 2>&1 && command -v pdftoppm >/dev/null 2>&1; then
  echo "✓ OCR déjà disponible (tesseract + poppler)"
elif command -v pacman >/dev/null 2>&1; then
  echo "→ installation de la stack OCR ($OCR_PKGS)…"
  if sudo pacman -S --needed --noconfirm $OCR_PKGS; then
    echo "✓ OCR installé"
  else
    echo "⚠ install OCR échouée — Vela fonctionne ; relance plus tard ou via le bouton « Installer » dans l'app"
  fi
else
  echo "○ pacman absent — pour l'OCR : installe $OCR_PKGS avec ton gestionnaire de paquets"
fi

# ── Conversion documents (optionnel, lourd) — signalé, pas auto-installé ──────────────────────
for tool in pandoc libreoffice; do
  command -v "$tool" >/dev/null 2>&1 && echo "✓ $tool présent" || echo "○ $tool absent (conversion docs)  →  sudo pacman -S $tool"
done
