#!/usr/bin/env bash
# Lance Vela en mode dev (Tauri). PID dans .vela.pid, logs reset dans logs/.
set -euo pipefail
cd "$(dirname "$0")"

mkdir -p logs
: > logs/dev.log

# WebKitGTK + Nvidia + Wayland : le renderer DMABUF provoque un crash
# "Gdk Error 71 (Protocol error)". Workaround standard sur cette workstation.
export WEBKIT_DISABLE_DMABUF_RENDERER=1

if [ -f .vela.pid ] && kill -0 "$(cat .vela.pid)" 2>/dev/null; then
  echo "Vela tourne déjà (PID $(cat .vela.pid)). ./stop.sh d'abord."
  exit 1
fi

nohup bun run tauri dev >> logs/dev.log 2>&1 &
echo $! > .vela.pid
echo "Vela démarré (PID $(cat .vela.pid)). Logs: logs/dev.log"
