#!/usr/bin/env bash
# Redémarre Vela proprement.
set -uo pipefail
cd "$(dirname "$0")"
./stop.sh
sleep 1
./start.sh
