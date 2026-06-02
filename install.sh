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
