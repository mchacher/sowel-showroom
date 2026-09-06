#!/usr/bin/env bash
# Validates every compose file in the repo with `docker compose config`, and
# refuses one that mounts the Docker socket: a container with the socket is
# root on the host, and the showroom is exposed to the internet (Sowel spec 105).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

found=0
for f in docker-compose*.yml compose*.yml; do
  [ -f "$f" ] || continue
  found=1
  if grep -q "docker.sock" "$f"; then
    echo "❌ $f mounts the Docker socket — never in the showroom." >&2
    exit 1
  fi
  if command -v docker >/dev/null 2>&1; then
    docker compose -f "$f" config --quiet
    echo "✓ $f"
  else
    echo "docker not installed — skipped config validation of $f (CI runs it)." >&2
  fi
done

[ "$found" -eq 1 ] || echo "No compose file yet — nothing to validate."
