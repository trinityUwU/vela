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
