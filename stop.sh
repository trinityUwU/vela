#!/usr/bin/env bash
# Arrête Vela et nettoie le PID.
set -uo pipefail
cd "$(dirname "$0")"

if [ -f .vela.pid ]; then
  PID="$(cat .vela.pid)"
  pkill -P "$PID" 2>/dev/null || true
  kill "$PID" 2>/dev/null || true
  rm -f .vela.pid
  echo "Vela arrêté."
else
  echo "Aucun PID. Nettoyage des process tauri/vela résiduels."
  pkill -f "tauri dev" 2>/dev/null || true
fi
