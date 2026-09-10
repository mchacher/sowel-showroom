#!/usr/bin/env bash
# Generates `proxy/nginx.conf` from `scripts/deny-list.txt` (spec 001, FR3).
#
# The deny list is the data; this is the only thing that turns it into config. Run
# with `--check` to fail when the committed file has drifted from the data, which
# is what `npm run validate` does: a deny list and a proxy config that disagree
# would be a security rule that exists only on paper.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DENY_LIST="scripts/deny-list.txt"
OUT="proxy/nginx.conf"
MODE="${1:-write}"

deny_map_entries() {
  grep -E '^deny ' "$DENY_LIST" | while read -r _ method matcher route comment; do
    reason="${comment#\# }"
    if [ "$matcher" = "=" ]; then
      key="\"$method:$route\""
    else
      # The route already carries its own anchors; the method is prefixed inside
      # them, so the leading `^` moves rather than doubling.
      key="\"~^$method:${route#^}\""
    fi
    printf '  %-58s 1;  # %s\n' "$key" "$reason"
  done
}

generate() {
  cat <<'HEADER'
# ============================================================
# GENERATED — do not edit.
#
# Written by `scripts/generate-proxy-conf.sh` from `scripts/deny-list.txt`, which
# is where the reasons live. Edit that file and re-run; `npm run validate` fails
# when this one has drifted from it.
#
# What this does, in order of how much it matters:
#
#   1. Refuses the handful of requests that would end the demo for everyone else
#      — a password change, an MFA enrolment — even though the core's role gate
#      allows them for a `standard` user. The guest account is shared, which the
#      core has no way to know.
#   2. Rate-limits mutations per IP, so a script cannot drive the house.
#   3. Serves the landing page, and proxies everything else to Sowel.
#
# Sowel's port is not published on the host, so this is the only way in.
# ============================================================

# Only mutations are counted. An empty key is not counted at all by nginx, which
# is the documented way to exempt reads without a second zone.
map $request_method $mutation_key {
  default "";
  POST    $binary_remote_addr;
  PUT     $binary_remote_addr;
  PATCH   $binary_remote_addr;
  DELETE  $binary_remote_addr;
}

# 30 a minute is one every two seconds sustained; the burst is what makes a
# flurry of clicks feel like a house rather than a queue.
limit_req_zone $mutation_key zone=mutations:10m rate=30r/m;
limit_req_status 429;

# What a visitor may not do. Generated from scripts/deny-list.txt.
map "$request_method:$uri" $denied {
  default 0;
HEADER
  deny_map_entries
  cat <<'FOOTER'
}

upstream sowel {
  server sowel:3000;
  keepalive 16;
}

server {
  listen 80;
  server_name _;

  # A visitor's own doing is their business; the access log is not a visitor log.
  access_log /var/log/nginx/access.log combined;
  client_max_body_size 2m;

  # --- The landing page ---------------------------------------------------
  # Served from the proxy so it works before Sowel is up, which is exactly when
  # somebody arrives during a reset.
  location = / {
    root /usr/share/nginx/html;
    try_files /index.html =404;
  }
  location /showroom/ {
    root /usr/share/nginx/html;
  }

  # --- The API -----------------------------------------------------------
  location /api/ {
    if ($denied) {
      return 403;
    }
    limit_req zone=mutations burst=5 nodelay;

    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_read_timeout 60s;
  }

  # --- The WebSocket -----------------------------------------------------
  # One connection per visitor, carrying the whole live house. Never rate-limited:
  # throttling it would break the thing the demo is for.
  location = /ws {
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }

  # --- The product UI ----------------------------------------------------
  location / {
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
  }
}
FOOTER
}

if [ "$MODE" = "--check" ]; then
  if ! diff -u "$OUT" <(generate) > /tmp/proxy-conf.diff 2>&1; then
    echo "❌ $OUT has drifted from $DENY_LIST. Run scripts/generate-proxy-conf.sh:" >&2
    head -40 /tmp/proxy-conf.diff >&2
    exit 1
  fi
  echo "✓ $OUT matches $DENY_LIST"
else
  generate > "$OUT"
  echo "✓ wrote $OUT from $DENY_LIST"
fi
