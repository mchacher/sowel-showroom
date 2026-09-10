#!/usr/bin/env bash
# Checks the proxy config two ways (spec 001, FR3 and FR7).
#
#   1. It matches the deny list it is generated from, so a security rule cannot
#      exist in the data and not in the config, or the reverse.
#   2. nginx itself accepts it. `--add-host` stubs the upstream, because outside
#      the compose network `sowel` does not resolve and nginx refuses to start on
#      an unresolvable upstream — which would otherwise make this check useless
#      everywhere except in production.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

bash scripts/generate-proxy-conf.sh --check

if ! command -v docker >/dev/null 2>&1 || ! docker info >/dev/null 2>&1; then
  echo "⚠ docker unavailable — skipped nginx syntax check (CI runs it)." >&2
  exit 0
fi

image=$(grep -oE 'nginx:[0-9.]+-alpine' compose.yml | head -1)
docker run --rm --add-host sowel:127.0.0.1 \
  -v "$PWD/proxy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  "$image" nginx -t 2>&1 | grep -E "syntax is ok|test is successful|emerg" || true

docker run --rm --add-host sowel:127.0.0.1 \
  -v "$PWD/proxy/nginx.conf:/etc/nginx/conf.d/default.conf:ro" \
  "$image" nginx -t >/dev/null 2>&1
echo "✓ nginx accepts proxy/nginx.conf"
